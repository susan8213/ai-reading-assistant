import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../entrypoints/sidepanel/App'

const createSessionMock = vi.fn()
const sendChatMessageMock = vi.fn()
const getActiveTabMock = vi.fn()
const sendMessageToTabMock = vi.fn()

vi.mock('../entrypoints/sidepanel/utils/api', () => ({
  createSession: (...args: unknown[]) => createSessionMock(...args),
  sendChatMessage: (...args: unknown[]) => sendChatMessageMock(...args),
}))

vi.mock('../entrypoints/sidepanel/utils/tab', () => ({
  getActiveTab: (...args: unknown[]) => getActiveTabMock(...args),
  sendMessageToTab: (...args: unknown[]) => sendMessageToTabMock(...args),
}))

describe('sidepanel session behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    sendMessageToTabMock.mockResolvedValue({ content: 'mock content' })
    sendChatMessageMock.mockResolvedValue({ reply: 'ok' })
  })

  afterEach(() => {
    cleanup()
  })

  it('uses different sessions for two different tabs', async () => {
    const user = userEvent.setup()

    getActiveTabMock
      .mockResolvedValueOnce({ id: 1, url: 'https://example.com/a' })
      .mockResolvedValueOnce({ id: 2, url: 'https://example.com/b' })

    createSessionMock
      .mockResolvedValueOnce({ session_id: 'session-tab-1' })
      .mockResolvedValueOnce({ session_id: 'session-tab-2' })

    render(<App />)

    const input = screen.getByPlaceholderText('Ask about this page...')
    const sendButton = screen.getByRole('button', { name: 'Send' })

    await user.type(input, 'hello from tab 1')
    await user.click(sendButton)

    await waitFor(() => {
      expect(sendChatMessageMock).toHaveBeenCalledWith(
        {
          session_id: 'session-tab-1',
          message: 'hello from tab 1',
          highlights: [],
        },
        expect.any(Object),
      )
    })

    await user.type(input, 'hello from tab 2')
    await user.click(sendButton)

    await waitFor(() => {
      expect(sendChatMessageMock).toHaveBeenCalledWith(
        {
          session_id: 'session-tab-2',
          message: 'hello from tab 2',
          highlights: [],
        },
        expect.any(Object),
      )
    })

    expect(createSessionMock).toHaveBeenCalledTimes(2)
  })

  it('reuses the same session for the same tab and unchanged URL', async () => {
    const user = userEvent.setup()

    getActiveTabMock
      .mockResolvedValueOnce({ id: 9, url: 'https://example.com/same' })
      .mockResolvedValueOnce({ id: 9, url: 'https://example.com/same' })

    createSessionMock.mockResolvedValueOnce({ session_id: 'session-same-tab-url' })

    render(<App />)

    const input = screen.getByPlaceholderText('Ask about this page...')
    const sendButton = screen.getByRole('button', { name: 'Send' })

    await user.type(input, 'first same-url message')
    await user.click(sendButton)

    await waitFor(() => {
      expect(sendChatMessageMock).toHaveBeenCalledWith(
        {
          session_id: 'session-same-tab-url',
          message: 'first same-url message',
          highlights: [],
        },
        expect.any(Object),
      )
    })

    await user.type(input, 'second same-url message')
    await user.click(sendButton)

    await waitFor(() => {
      expect(sendChatMessageMock).toHaveBeenCalledWith(
        {
          session_id: 'session-same-tab-url',
          message: 'second same-url message',
          highlights: [],
        },
        expect.any(Object),
      )
    })

    expect(createSessionMock).toHaveBeenCalledTimes(1)
  })

  it('creates a new session when the same tab changes URL', async () => {
    const user = userEvent.setup()

    getActiveTabMock
      .mockResolvedValueOnce({ id: 5, url: 'https://example.com/original' })
      .mockResolvedValueOnce({ id: 5, url: 'https://example.com/changed' })

    createSessionMock
      .mockResolvedValueOnce({ session_id: 'session-original-url' })
      .mockResolvedValueOnce({ session_id: 'session-changed-url' })

    render(<App />)

    const input = screen.getByPlaceholderText('Ask about this page...')
    const sendButton = screen.getByRole('button', { name: 'Send' })

    await user.type(input, 'first url message')
    await user.click(sendButton)

    await waitFor(() => {
      expect(sendChatMessageMock).toHaveBeenCalledWith(
        {
          session_id: 'session-original-url',
          message: 'first url message',
          highlights: [],
        },
        expect.any(Object),
      )
    })

    await user.type(input, 'changed url message')
    await user.click(sendButton)

    await waitFor(() => {
      expect(sendChatMessageMock).toHaveBeenCalledWith(
        {
          session_id: 'session-changed-url',
          message: 'changed url message',
          highlights: [],
        },
        expect.any(Object),
      )
    })

    expect(createSessionMock).toHaveBeenCalledTimes(2)
  })
})
