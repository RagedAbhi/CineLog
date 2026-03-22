import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

export const signup = async (userData) => {
    const response = await axios.post(`${API_URL}/signup`, userData);
    if (response.data.token) {
        localStorage.setItem('token', response.data.token);
    }
    return response.data;
};

export const login = async (credentials) => {
    const response = await axios.post(`${API_URL}/login`, credentials);
    if (response.data.token) {
        localStorage.setItem('token', response.data.token);
    }
    return response.data;
};

export const logout = () => {
    localStorage.removeItem('token');
};

export const getMe = async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const response = await axios.get('http://localhost:5000/api/users/me', {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};
