import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { signup, login } from '../store/thunks';
import '../styles/global.css';

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        name: ''
    });
    const [error, setError] = useState('');

    const dispatch = useDispatch();
    const { loading, error: authError } = useSelector(state => state.auth);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isLogin) {
                await dispatch(login({ email: formData.email, password: formData.password }));
            } else {
                await dispatch(signup(formData));
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="auth-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="auth-card glass-panel-premium" style={{ width: '100%', maxWidth: '440px' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 className="auth-logo">CineLog</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
                        {isLogin ? 'Welcome back! Ready for a movie?' : 'Start your personal movie diary today.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {!isLogin && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input className="form-input" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input className="form-input" name="username" value={formData.username} onChange={handleChange} placeholder="johndoe" required />
                            </div>
                        </>
                    )}
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input className="form-input" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="hello@example.com" required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input className="form-input" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" required />
                    </div>

                    {(error || authError) && (
                        <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.2)', color: 'var(--red)', fontSize: '14px', fontWeight: 500 }}>
                            {error || authError}
                        </div>
                    )}

                    <button className="btn btn-primary" type="submit" disabled={loading} style={{ height: '54px', marginTop: '8px' }}>
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '15px', color: 'var(--text-secondary)' }}>
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="auth-btn-toggle"
                    >
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
