class EventEmitter {
  private events: { [key: string]: Function[] };

  constructor() {
    this.events = {};
  }

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (!this.events[event]) return;

    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach((listener) => {
      listener(...args);
    });
  }
}

export const errorEmitter = new EventEmitter();
