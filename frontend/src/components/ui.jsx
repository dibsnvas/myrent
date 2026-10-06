/** Building blocks of the Figma layout: creamy panels, tiles with a corner button, status pills, stepper. */
import { IconArrowUpRight, IconCheck, IconPencil } from '@tabler/icons-react'
import { Link } from 'react-router-dom'

export function Panel({ title, actions, children, className = '', ...rest }) {
  return (
    <section className={`mr-panel ${className}`} {...rest}>
      {(title || actions) && (
        <div className="mr-panel-head">
          {title && <h2 className="mr-panel-title">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * A tile: small label, big value. Corner button: `to` = ↗ link to a page, `onEdit` = pencil.
 * tone: 'light' (cream), 'dark' (#574344), 'mid' (#765C5D), 'soft'.
 */
export function Tile({ label, value, sub, tone = 'light', to, onEdit, editLabel = 'Edit', children, className = '', style }) {
  return (
    <div className={`mr-tile ${className}`} data-tone={tone} style={style}>
      {label && <div className="mr-tile-label">{label}</div>}
      {value !== undefined && <div className="mr-tile-value">{value}</div>}
      {sub && <div className="mr-tile-sub">{sub}</div>}
      {children}
      {to && (
        <Link to={to} className="mr-corner" aria-label={`Open ${label ?? ''}`.trim()}>
          <IconArrowUpRight size={16} />
        </Link>
      )}
      {!to && onEdit && (
        <button type="button" className="mr-corner" onClick={onEdit} aria-label={`${editLabel} ${label ?? ''}`.trim()}>
          <IconPencil size={15} />
        </button>
      )}
    </div>
  )
}

/** The big "+ Add data about …" area of the empty Figma screens. */
export function EmptyAdd({ children, onClick, to }) {
  if (to) {
    return (
      <Link to={to} className="mr-empty-add" style={{ textDecoration: 'none' }}>
        + {children}
      </Link>
    )
  }
  return (
    <button type="button" className="mr-empty-add" onClick={onClick}>
      + {children}
    </button>
  )
}

export function StatusPill({ status, labels = { paid: 'Paid', due: 'Due', overdue: 'Overdue' } }) {
  return (
    <span className="mr-status" data-status={status}>
      {labels[status] ?? status}
    </span>
  )
}

/** Numbered steps; finished steps show a check. */
export function Steps({ steps, active }) {
  return (
    <div className="mr-steps">
      {steps.map((label, index) => {
        const state = index < active ? 'done' : index === active ? 'current' : 'todo'
        return (
          <div key={label} className="mr-step" data-state={state}>
            <span className="mr-step-dot">{state === 'done' ? <IconCheck size={20} /> : index + 1}</span>
            {label}
          </div>
        )
      })}
    </div>
  )
}
