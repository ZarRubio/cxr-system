"""Cache LRU en memoria, seguro para acceso concurrente."""
import threading
from collections import OrderedDict
from typing import Any


class LRUCache:
    """
    Cache LRU acotado. Todas las operaciones toman un lock, por lo que es seguro
    compartirlo entre requests concurrentes dentro de un mismo proceso.
    """

    def __init__(self, maxsize: int = 20) -> None:
        if maxsize < 1:
            raise ValueError("maxsize debe ser >= 1")
        self._maxsize = maxsize
        self._data: OrderedDict[str, Any] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            if key not in self._data:
                return None
            self._data.move_to_end(key)
            return self._data[key]

    def put(self, key: str, value: Any) -> None:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
            self._data[key] = value
            while len(self._data) > self._maxsize:
                self._data.popitem(last=False)

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)

    def __contains__(self, key: str) -> bool:
        with self._lock:
            return key in self._data
