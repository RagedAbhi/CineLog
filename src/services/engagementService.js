import axios from 'axios';
import config from '../config';

const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
});

export const getCounts = (imdbID) =>
    axios.get(`${config.API_URL}/api/engagement/${imdbID}/counts`, { headers: getHeaders() })
        .then(r => r.data);

export const getEngagement = (imdbID) =>
    axios.get(`${config.API_URL}/api/engagement/${imdbID}`, { headers: getHeaders() })
        .then(r => r.data);

export const toggleLike = (imdbID) =>
    axios.post(`${config.API_URL}/api/engagement/${imdbID}/like`, {}, { headers: getHeaders() })
        .then(r => r.data);

export const addComment = (imdbID, text) =>
    axios.post(`${config.API_URL}/api/engagement/${imdbID}/comment`, { text }, { headers: getHeaders() })
        .then(r => r.data);

export const deleteComment = (imdbID, commentId) =>
    axios.delete(`${config.API_URL}/api/engagement/${imdbID}/comment/${commentId}`, { headers: getHeaders() })
        .then(r => r.data);

export const toggleCommentHeart = (imdbID, commentId) =>
    axios.post(`${config.API_URL}/api/engagement/${imdbID}/comment/${commentId}/heart`, {}, { headers: getHeaders() })
        .then(r => r.data);

export const getWatchedByFriends = (imdbID) =>
    axios.get(`${config.API_URL}/api/engagement/${imdbID}/watched-by-friends`, { headers: getHeaders() })
        .then(r => r.data);

export const updatePrivacy = (isPrivate) =>
    axios.patch(`${config.API_URL}/api/users/privacy`, { isPrivate }, { headers: getHeaders() })
        .then(r => r.data);
