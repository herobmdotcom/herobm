import { SimEvent } from './catalogue';

export class Timeline {
  private events: SimEvent[] = [];

  addEvent(event: SimEvent) {
    this.events.push(event);
    this.events.sort((a, b) => a.timestamp - b.timestamp);
  }

  popNextEvent(): SimEvent | undefined {
    return this.events.shift();
  }

  peekNextEvent(): SimEvent | undefined {
    return this.events[0];
  }

  getAllEvents() {
    return this.events;
  }
}
