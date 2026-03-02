import './style.css'

const appElement = document.querySelector('#app')

appElement.innerHTML = `
  <main class="todo-app" aria-label="Todo list application">
    <header class="todo-header">
      <h1 class="todo-title">Todo List</h1>
      <p class="todo-subtitle">Capture tasks and keep track of what’s left.</p>
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

let todos = []

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

    checkbox.addEventListener('change', () => {
      todos = todos.map((t) =>
        t.id === todo.id ? { ...t, completed: checkbox.checked } : t,
      )
      renderTodos()
    })

    deleteButton.addEventListener('click', () => {
      todos = todos.filter((t) => t.id !== todo.id)
      renderTodos()
    })
  })

  updateCount()
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const text = input.value.trim()
  if (!text) return

  const newTodo = {
    id: Date.now(),
    text,
    completed: false,
  }

  todos = [...todos, newTodo]
  input.value = ''
  input.focus()

  renderTodos()
})

renderTodos()
