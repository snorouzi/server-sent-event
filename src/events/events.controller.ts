import {
  BadRequestException,
  Body,
  Controller,
  MessageEvent,
  Post,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse()
  stream(): Observable<MessageEvent> {
    return this.eventsService.subscribe();
  }

  @Post()
  broadcast(@Body() body: unknown) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestException('Request body must be a valid JSON object');
    }

    const clients = this.eventsService.broadcast('message', body);

    return {
      success: true,
      message:
        clients > 0
          ? 'Event broadcast successfully'
          : 'Event broadcast successfully (no connected SSE clients)',
      clients,
      data: body,
    };
  }
}
