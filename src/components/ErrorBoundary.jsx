import { Component } from 'react'
import './css/ErrorBoundary.css'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('CivilPYQ crashed:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <h2>Something went wrong</h2>
            <p>This page hit an unexpected error. Refreshing usually fixes it.</p>
            <button className="error-boundary-btn" onClick={this.handleReload}>Refresh page</button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
