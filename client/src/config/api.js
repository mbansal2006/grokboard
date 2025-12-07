// API Configuration
// This file determines the correct API URL at runtime

const getApiBaseUrl = () => {
  // Check if we have an explicit API URL that's not localhost
  const envUrl = import.meta.env.VITE_API_URL
  
  // If VITE_API_URL is explicitly set and it's not localhost, use it
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl
  }
  
  // Detect if we're running in production (not localhost)
  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1')
    
    // If not localhost, we're in production - use relative URLs (same origin)
    // This works for Fly.io and other deployments where frontend/backend are on same domain
    if (!isLocalhost) {
      // Use empty string for relative URLs - requests will go to same origin
      return ''
    }
  }
  
  // Default to localhost for local development
  return envUrl || 'http://localhost:3001'
}

export const API_BASE_URL = getApiBaseUrl()

// Log the API URL being used (helpful for debugging)
if (typeof window !== 'undefined') {
  console.log('API Base URL:', API_BASE_URL)
  console.log('Environment:', import.meta.env.MODE)
  console.log('VITE_API_URL from env:', import.meta.env.VITE_API_URL)
}
