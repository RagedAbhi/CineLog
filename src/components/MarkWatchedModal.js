import React, { Component } from 'react';
import { Star } from 'lucide-react';

class MarkWatchedModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rating: 7,
      hoverRating: 0,
      review: '',
      watchedOn: new Date().toISOString().split('T')[0]
    };
  }

  componentDidMount() {
    document.body.classList.add('modal-open');
  }

  componentWillUnmount() {
    document.body.classList.remove('modal-open');
  }

  handleChange = (e) => {
    const { name, value } = e.target;
    this.setState({ [name]: value });
  }

  handleRating = (val) => {
    this.setState({ rating: val });
  }

  handleSubmit = (e) => {
    e.preventDefault();
    this.props.onSubmit({
      rating: this.state.rating,
      review: this.state.review,
      watchedOn: this.state.watchedOn
    });
  }

  render() {
    const { movie, onClose } = this.props;
    const { rating, review, watchedOn } = this.state;

    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="modal-header">
            <h3>Mark as Watched</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body" data-lenis-prevent>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              You watched <strong style={{ color: 'var(--text-primary)' }}>{movie?.title}</strong>. How was it?
            </p>

            <form onSubmit={this.handleSubmit}>
              <div className="form-group">
                <label className="form-label">Rating</label>
                <div className="star-rating-container">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                    <div
                      key={num}
                      className={`star-item ${num <= (this.state.hoverRating || rating) ? 'filled' : ''} ${num <= this.state.hoverRating ? 'hovered' : ''}`}
                      onMouseEnter={() => this.setState({ hoverRating: num })}
                      onMouseLeave={() => this.setState({ hoverRating: 0 })}
                      onClick={() => this.handleRating(num)}
                    >
                      <Star 
                        size={28} 
                        fill={num <= (this.state.hoverRating || rating) ? "#FFC107" : "transparent"} 
                        strokeWidth={1.5}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#FFC107', fontSize: '18px' }}>★</span>
                  <span>{rating}/10</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400' }}>
                    ({rating <= 3 ? 'Weak' : (rating <= 6 ? 'Decent' : (rating <= 8 ? 'Great' : 'Masterpiece'))})
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Review (optional)</label>
                <textarea
                  className="form-input"
                  name="review"
                  value={review}
                  onChange={this.handleChange}
                  placeholder="What did you think?"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

export default MarkWatchedModal;
