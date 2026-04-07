import axios from 'axios';
import config from '../config';

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export const createRoom = async ({ contentId, contentTitle, contentType, netflixUrl }) => {
    const res = await axios.post(
        `${config.API_URL}/api/rooms`,
        { contentId, contentTitle, contentType, netflixUrl },
        authHeader()
    );
    return res.data;
};

export const getRoom = async (code) => {
    const res = await axios.get(`${config.API_URL}/api/rooms/${code}`, authHeader());
    return res.data;
};

export const joinRoom = async (code) => {
    const res = await axios.post(`${config.API_URL}/api/rooms/${code}/join`, {}, authHeader());
    return res.data;
};

export const leaveRoom = async (code) => {
    const res = await axios.post(`${config.API_URL}/api/rooms/${code}/leave`, {}, authHeader());
    return res.data;
};
