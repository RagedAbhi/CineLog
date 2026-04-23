import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import config from '../config';

export default function useGameSocket({ roomCode, onEvent }) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomCode) return;

    const token = localStorage.getItem('token');
    const socket = io(config.API_URL, { 
        auth: { token }, 
        transports: ['websocket'],
        reconnection: true
    });
    socketRef.current = socket;

    socket.emit('game:join_room', { roomCode });

    // Forward all game: events to the onEvent callback
    const events = [
      'game:player_joined', 'game:puzzle', 'game:state_update',
      'game:round_end', 'game:next_round', 'game:over',
      'game:hint', 'game:player_left', 'game:error'
    ];
    
    events.forEach(event => {
      socket.on(event, data => {
          if (onEvent) onEvent(event, data);
      });
    });

    return () => {
        socket.disconnect();
    };
  }, [roomCode]); // Only re-run if roomCode changes

  const emit = useCallback((event, data) => {
    if (socketRef.current) {
        socketRef.current.emit(event, data);
    }
  }, []);

  return { emit };
}
