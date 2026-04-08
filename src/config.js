const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = process.env.REACT_APP_API_URL || (isLocal ? 'http://localhost:5000' : 'https://cuerates.onrender.com');

export default {
    API_URL,
    BASE_API_URL: `${API_URL}/api`,
    SOCKET_URL: API_URL
};
