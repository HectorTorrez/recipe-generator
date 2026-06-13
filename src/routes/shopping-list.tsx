import { Link, createFileRoute } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'
import { AuthHeader } from '../components/AuthHeader'
import {
  clearCheckedItems,
  getServerShoppingListSnapshot,
  getShoppingListSnapshot,
  removeShoppingItem,
  subscribeShoppingList,
  toggleShoppingItem,
} from '../lib/shopping-list'

export const Route = createFileRoute('/shopping-list')({
  component: ShoppingListPage,
})

function ShoppingListPage() {
  const items = useSyncExternalStore(
    subscribeShoppingList,
    getShoppingListSnapshot,
    getServerShoppingListSnapshot,
  )

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar__inner">
          <Link to="/" className="top-bar__brand">
            <span className="top-bar__logo" aria-hidden="true">
              ◐
            </span>
            Pantry
          </Link>
          <AuthHeader />
        </div>
      </header>

      <section className="hero hero--compact">
        <div className="hero__inner">
          <p className="hero__eyebrow">What to buy</p>
          <h1 className="hero__title">Shopping list</h1>
          <p className="hero__lead">
            Missing ingredients collected from your recipes.
          </p>
        </div>
      </section>

      <main className="workspace workspace--single">
        <section className="panel panel--wide">
          <div className="results-header">
            <h2 className="panel__title">
              Items to buy
              <span className="history-slots">{items.length} items</span>
            </h2>
            <div className="results-header__actions">
              {items.some((i) => i.checked) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => clearCheckedItems()}
                >
                  Clear checked
                </button>
              )}
              <Link to="/" className="btn btn-ghost btn-sm">
                Back to pantry
              </Link>
            </div>
          </div>

          {items.length === 0 && (
            <div className="empty-recipes">
              <p className="empty-recipes__title">List is empty</p>
              <p className="empty-recipes__text">
                Add missing ingredients from recipe cards using "Add to shopping
                list".
              </p>
            </div>
          )}

          <ul className="shopping-list">
            {items.map((item) => (
              <li
                key={item.id}
                className={`shopping-list__item${item.checked ? ' shopping-list__item--checked' : ''}`}
              >
                <label className="shopping-list__label">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleShoppingItem(item.id)}
                  />
                  <span>{item.name}</span>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => removeShoppingItem(item.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
