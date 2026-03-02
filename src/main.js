import './style.css'
import { supabase } from './supabaseClient'

const appElement = document.querySelector('#app')

appElement.innerHTML = `
  <main class="todo-app" aria-label="Todo list application">
    <header class="todo-header">
      <div>
        <h1 class="todo-title">Todo List</h1>
        <p class="todo-subtitle">Capture tasks and keep track of what’s left.</p>
      </div>
      <div class="auth-bar" aria-label="Account status">
        <span class="auth-status"></span>
        <div class="auth-actions">
          <button type="button" class="auth-signup">Sign up</button>
          <button type="button" class="auth-login">Log in</button>
          <button type="button" class="auth-logout" hidden>Log out</button>
        </div>
      </div>
    </header>

    <form class="todo-input-row" autocomplete="off">
      <input
        class="todo-input"
        type="text"
        name="todo"
        placeholder="Add a new task"
        aria-label="Add a new todo"
      />
      <button type="submit">Add</button>
    </form>

    <ul class="todo-list" aria-live="polite"></ul>

    <footer class="todo-footer">
      <span class="todo-count">0 items left</span>
    </footer>
  </main>
`

const form = appElement.querySelector('.todo-input-row')
const input = appElement.querySelector('.todo-input')
const list = appElement.querySelector('.todo-list')
const countEl = appElement.querySelector('.todo-count')
const authStatusEl = appElement.querySelector('.auth-status')
const signupButton = appElement.querySelector('.auth-signup')
const loginButton = appElement.querySelector('.auth-login')
const logoutButton = appElement.querySelector('.auth-logout')

let todos = []
let currentUser = null

function renderAuthUI() {
  if (!authStatusEl || !signupButton || !loginButton || !logoutButton) return

  if (!currentUser) {
    authStatusEl.textContent = 'Not signed in'
    signupButton.disabled = false
    loginButton.disabled = false
    logoutButton.hidden = true
    return
  }

  if (currentUser.email) {
    authStatusEl.textContent = `Signed in as ${currentUser.email}`
    signupButton.disabled = true
    loginButton.disabled = true
    logoutButton.hidden = false
  } else {
    authStatusEl.textContent = 'Using a temporary account'
    signupButton.disabled = false
    loginButton.disabled = false
    logoutButton.hidden = false
  }
}

async function initAuth() {
  // Try to get an existing session first.
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    console.error('Error getting auth session', error)
  }

  let user = session?.user ?? null

  if (!user) {
    // No session yet: transparently sign in anonymously so the user
    // can start using the app immediately.
    const { data, error: anonError } = await supabase.auth.signInAnonymously()
    if (anonError) {
      console.error('Error signing in anonymously', anonError)
    } else {
      user = data?.user ?? null
    }
  }

  currentUser = user
  renderAuthUI()

  // Keep auth state in sync with Supabase.
  supabase.auth.onAuthStateChange((_event, newSession) => {
    currentUser = newSession?.user ?? null
    renderAuthUI()
    // Refetch todos when auth state changes so we show the right list.
    refreshTodos()
  })
}

async function fetchTodos() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching todos', error)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    text: row.text ?? '',
    completed: !!row.completed,
  }))
}

async function createTodo(text) {
  if (!currentUser) {
    console.error('No authenticated user to attach todo to')
    return null
  }

  const { data, error } = await supabase
    .from('todos')
    .insert({ text, completed: false, user_id: currentUser.id })
    .select()
    .single()

  if (error) {
    console.error('Error creating todo', error)
    return null
  }

  return {
    id: data.id,
    text: data.text ?? '',
    completed: !!data.completed,
  }
}

async function updateTodo(id, updates) {
  const { error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Error updating todo', error)
    return false
  }

  return true
}

async function deleteTodo(id) {
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting todo', error)
    return false
  }

  return true
}

function updateCount() {
  const remaining = todos.filter((t) => !t.completed).length
  const label = remaining === 1 ? 'item' : 'items'
  countEl.textContent = `${remaining} ${label} left`
}

function renderTodos() {
  list.innerHTML = ''

  todos.forEach((todo) => {
    const li = document.createElement('li')
    li.className = 'todo-item'
    if (todo.completed) {
      li.classList.add('todo-item--completed')
    }

    const left = document.createElement('div')
    left.className = 'todo-item-left'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = todo.completed
    checkbox.className = 'todo-checkbox'
    checkbox.setAttribute('aria-label', `Mark "${todo.text}" as completed`)

    const label = document.createElement('span')
    label.className = 'todo-item-label'
    label.textContent = todo.text

    left.appendChild(checkbox)
    left.appendChild(label)

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.className = 'todo-delete'
    deleteButton.setAttribute('aria-label', `Delete "${todo.text}"`)
    deleteButton.textContent = 'Delete'

    li.appendChild(left)
    li.appendChild(deleteButton)
    list.appendChild(li)

    checkbox.addEventListener('change', async () => {
      const nextCompleted = !todo.completed
      const ok = await updateTodo(todo.id, { completed: nextCompleted })
      if (!ok) {
        // Revert checkbox if update fails
        checkbox.checked = todo.completed
        return
      }

      todos = todos.map((t) =>
        t.id === todo.id ? { ...t, completed: nextCompleted } : t,
      )
      renderTodos()
    })

    deleteButton.addEventListener('click', async () => {
      const ok = await deleteTodo(todo.id)
      if (!ok) return

      todos = todos.filter((t) => t.id !== todo.id)
      renderTodos()
    })
  })

  updateCount()
}

async function refreshTodos() {
  todos = await fetchTodos()
  renderTodos()
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const text = input.value.trim()
  if (!text) return
  const created = await createTodo(text)
  if (!created) return

  todos = [...todos, created]
  input.value = ''
  input.focus()

  renderTodos()
})

signupButton.addEventListener('click', async () => {
  const email = window.prompt('Enter email for your account:')
  if (!email) return
  const password = window.prompt('Create a password:')
  if (!password) return

  const { error } = await supabase.auth.signUp({ email, password })
  if (error) {
    console.error('Error signing up', error)
    window.alert('Sign up failed. Please try again.')
    return
  }

  window.alert('Check your email to confirm your account, then log in.')
})

loginButton.addEventListener('click', async () => {
  const email = window.prompt('Email:')
  if (!email) return
  const password = window.prompt('Password:')
  if (!password) return

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('Error logging in', error)
    window.alert('Login failed. Please check your details and try again.')
    return
  }
})

logoutButton.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error logging out', error)
    window.alert('Log out failed. Please try again.')
    return
  }
})

async function init() {
  await initAuth()
  await refreshTodos()
}

init()
