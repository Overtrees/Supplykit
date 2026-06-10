from collections import defaultdict

class EventBus:
    def __init__(self):
        self.listeners = defaultdict(list)

    def on(self, event_name, handler):
        self.listeners[event_name].append(handler)

    def emit(self, event_name, payload):
        for handler in self.listeners.get(event_name, []):
            handler(payload)

bus = EventBus()
