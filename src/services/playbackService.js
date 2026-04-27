import axios from 'axios';
import config from '../config';

const BASE_URL = `${config.API_URL}/api/playback`;

const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return {
        headers: { Authorization: `Bearer ${token}` }
    };
};

export const updatePlaybackProgress = async (data) => {
    try {
        const response = await axios.post(`${BASE_URL}/update`, data, getAuthHeader());
        return response.data;
    } catch (error) {
        console.error('Failed to update playback progress:', error);
        return null;
    }
};

export const getPlaybackProgress = async (mediaId) => {
    try {
        const response = await axios.get(`${BASE_URL}/${mediaId}`, getAuthHeader());
        return response.data;
    } catch (error) {
        console.error('Failed to get playback progress:', error);
        return null;
    }
};

export const getAllPlaybackProgress = async () => {
    try {
        const response = await axios.get(`${BASE_URL}/all`, getAuthHeader());
        return response.data;
    } catch (error) {
        console.error('Failed to get all playback progress:', error);
        return [];
    }
};

export const deletePlaybackProgress = async (mediaId) => {
    try {
        const response = await axios.delete(`${BASE_URL}/${mediaId}`, getAuthHeader());
        return response.data;
    } catch (error) {
        console.error('Failed to delete playback progress:', error);
        return null;
    }
};
