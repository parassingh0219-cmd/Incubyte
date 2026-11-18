import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import App from './App'

describe('Company application', () => {
  beforeEach(() => localStorage.clear())

  it('renders the HR login page for unauthenticated users', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Company HR' })).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })
})
