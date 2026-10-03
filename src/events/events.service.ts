import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface SsePayload {
  type: string;
  data: object | string;
}

@Injectable()
export class EventsService {
  private readonly clients = new Set<Subject<SsePayload>>();

  get clientCount(): number {
    return this.clients.size;
  }

  subscribe(): Observable<SsePayload> {
    const subject = new Subject<SsePayload>();

    return new Observable<SsePayload>((subscriber) => {
      this.clients.add(subject);
      const subscription = subject.subscribe(subscriber);

      this.publishClientCount();

      return () => {
        subscription.unsubscribe();
        this.clients.delete(subject);
        this.publishClientCount();
      };
    });
  }

  private publishClientCount(): void {
    this.broadcast('clients', { clients: this.clients.size });
  }

  broadcast(event: string, data: object | string): number {
    let delivered = 0;

    for (const client of [...this.clients]) {
      try {
        client.next({ type: event, data });
        delivered += 1;
      } catch {
        this.clients.delete(client);
      }
    }

    return delivered;
  }
}
