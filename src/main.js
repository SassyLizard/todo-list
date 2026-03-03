import './style.css'
import { supabase } from './supabaseClient'

const appElement = document.querySelector('#app')

appElement.innerHTML = `
  <main class="todo-app" aria-label="Todo list application">
    <header class="todo-header">
      <div>
        <h1 class="todo-title">Todo List</h1>
      </div>
      <div class="auth-bar" aria-label="Account status">
        <span class="auth-status"></span>
        <div class="auth-actions">
          <button type="button" class="auth-signup auth-button">Sign up</button>
          <button type="button" class="auth-login auth-button">Log in</button>
          <button type="button" class="auth-logout auth-button" hidden>Log out</button>
        </div>
      </div>
    </header>

    <section class="auth-panel" hidden>
      <form class="auth-form" autocomplete="off">
        <input
          class="auth-email"
          type="email"
          name="email"
          placeholder="Email"
          aria-label="Email"
          required
        />
        <input
          class="auth-password"
          type="password"
          name="password"
          placeholder="Password"
          aria-label="Password"
          required
        />
        <button type="submit" class="auth-submit">Continue</button>
        <button type="button" class="auth-cancel">Cancel</button>
      </form>
    </section>

    <form class="todo-input-row" autocomplete="off">
      <input
        class="todo-input"
        type="text"
        name="todo"
        placeholder="Add a new task"
        aria-label="Add a new todo"
      />
      <button type="submit" class="todo-add-button">Add</button>
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
const authPanel = appElement.querySelector('.auth-panel')
const authForm = appElement.querySelector('.auth-form')
const authEmailInput = appElement.querySelector('.auth-email')
const authPasswordInput = appElement.querySelector('.auth-password')
const authSubmitButton = appElement.querySelector('.auth-submit')
const authCancelButton = appElement.querySelector('.auth-cancel')

let todos = []
let currentUser = null
let authMode = null // 'signup' | 'login' | null

function closeAuthForm() {
  if (!authPanel || !authForm) return
  authPanel.hidden = true
  authMode = null
  if (authEmailInput) authEmailInput.value = ''
  if (authPasswordInput) authPasswordInput.value = ''
}

function openAuthForm(mode) {
  if (
    !authPanel ||
    !authForm ||
    !authEmailInput ||
    !authPasswordInput ||
    !authSubmitButton
  )
    return
  authMode = mode
  authPanel.hidden = false
  authEmailInput.value = ''
  authPasswordInput.value = ''
  authSubmitButton.textContent = mode === 'signup' ? 'Create account' : 'Log in'
  authEmailInput.focus()
}

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
    authStatusEl.textContent = ''
    signupButton.disabled = false
    loginButton.disabled = false
    logoutButton.hidden = true
  }

  // Whenever auth state changes, hide any open auth form.
  closeAuthForm()
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
  supabase.auth.onAuthStateChange(async (_event, newSession) => {
    if (newSession) {
      currentUser = newSession.user
    } else {
      // Signed out: create a fresh anonymous session so the user can keep using the app.
      const { data, error: anonError } = await supabase.auth.signInAnonymously()
      if (anonError) {
        console.error('Error signing in anonymously after logout', anonError)
        currentUser = null
      } else {
        currentUser = data?.user ?? null
      }
    }
    renderAuthUI()
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

  if (todos.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'todo-empty'
    empty.textContent = 'Your list is empty at the moment ..'
    list.appendChild(empty)
    updateCount()
    return
  }

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
    deleteButton.textContent = '×'

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

signupButton.addEventListener('click', () => {
  openAuthForm('signup')
})

loginButton.addEventListener('click', () => {
  openAuthForm('login')
})

if (authCancelButton) {
  authCancelButton.addEventListener('click', () => {
    closeAuthForm()
  })
}

if (authForm) {
  authForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!authMode || !authEmailInput || !authPasswordInput) return

    const email = authEmailInput.value.trim()
    const password = authPasswordInput.value.trim()
    if (!email || !password) return

    if (authMode === 'signup') {
      // If we're currently anonymous, upgrade this anonymous user into
      // an email/password account so existing todos stay attached.
      if (currentUser && !currentUser.email) {
        const { error } = await supabase.auth.updateUser({ email, password })
        if (error) {
          console.error('Error upgrading anonymous user', error)
          window.alert('Sign up failed. Please try again.')
          return
        }
        window.alert('Account created from your temporary session.')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) {
          console.error('Error signing up', error)
          window.alert('Sign up failed. Please try again.')
          return
        }
        window.alert('Check your email to confirm your account, then log in.')
      }
    } else if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        console.error('Error logging in', error)
        window.alert('Login failed. Please check your details and try again.')
        return
      }
    }

    closeAuthForm()
  })
}

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
