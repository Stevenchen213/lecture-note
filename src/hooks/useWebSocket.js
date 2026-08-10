import { useRef, useState, useCallback, useEffect } from 'react';

// 开发环境用 localhost，生产环境用 VITE_WS_URL 环境变量
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

/**
 * WebSocket Hook
 * 管理与后端的 WebSocket 连接：音频数据发送 + JSON 消息收发
 */
export function useWebSocket() {
  const wsRef = useRef(null);
  const [error, setError] = useState(null);
  const listenersRef = useRef(new Map());

  // 注册消息监听器
  const on = useCallback((type, handler) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type).add(handler);
    return () => {
      listenersRef.current.get(type)?.delete(handler);
    };
  }, []);

  // 连接到服务器
  const connect = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setError(null);
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const handlers = listenersRef.current.get(msg.type);
          if (handlers) {
            handlers.forEach((fn) => fn(msg));
          }
        } catch {
          // 忽略无法解析的消息
        }
      };

      ws.onerror = () => {
        setError('WebSocket 连接失败，请确认服务器已启动');
        reject(new Error('WebSocket 连接失败'));
      };

      ws.onclose = () => {};

      wsRef.current = ws;
    });
  }, []);

  // 发送二进制音频数据
  const sendAudio = useCallback((buffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(buffer);
    }
  }, []);

  // 发送 JSON 控制指令
  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // 组件卸载时自动断开
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { error, connect, disconnect, send, sendAudio, on };
}
