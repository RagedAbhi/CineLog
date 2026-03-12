import { Component } from 'react';

class Toast extends Component {
  componentDidMount() {
    this.timer = setTimeout(() => {
      this.props.onClose();
    }, 3000);
  }

  componentWillUnmount() {
    clearTimeout(this.timer);
  }

  render() {
    const { message, type } = this.props;
    return (
      <div className={`toast ${type || ''}`}>
        {message}
      </div>
    );
  }
}

export default Toast;
