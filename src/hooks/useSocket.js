import { useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import { fetchRecommendations } from '../store/thunks';
import config from '../config';

const SOCKET_URL = config.SOCKET_URL;

let socket = null;

const useSocket = () => {
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();

    useEffect(() => {
        if (user && !socket) {
            const token = localStorage.getItem('token');
            socket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket']
            });

            socket.on('connect', () => {
                console.log('[Socket] Connected to server');
                // Join personal room
                socket.emit('join', user.id || user._id);
            });

            socket.on('new_recommendation', (data) => {
                console.log('[Socket] New recommendation received:', data);
                // 1. Refresh recommendations in Redux
                dispatch(fetchRecommendations());
                
                // 2. You could trigger a local browser notification here
                if (Notification.permission === "granted") {
                    new Notification("New Recommendation!", {
                        body: `${data.sender} recommended ${data.mediaTitle} to you.`
                    });
                }
            });

            socket.on('disconnect', () => {
                console.log('[Socket] Disconnected');
            });
        }

        return () => {
            if (socket) {
                // We keep the socket alive unless the user logs out
                // or we can disconnect here if we want per-component scope.
                // For Cuerates, global scope is better.
            }
        };
    }, [user, dispatch]);

    const emit = useCallback((event, data) => {
        if (socket) socket.emit(event, data);
    }, []);

    return { socket, emit };
};

export default useSocket;
