import React, { useId, useState } from 'react';
import './workflow.css';

const owners = ['Portfolio team', 'Finance lead', 'Clinical operations', 'Vendor management'];
const initials = name => name.split(' ').slice(0, 2).map(word => word[0]).join('');

function WorkflowIcon({ name, size = 16 }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18M7 15h2M13 15h2" /></>,
    flag: <><path d="M5 21V3c5-3 9 3 14 0v10c-5 3-9-3-14 0" /></>,
    building: <><path d="M4 21V5l8-3v19M12 9h8v12M2 21h20M7 7h2M7 11h2M7 15h2M15 12h2M15 16h2" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" /></>,
    circle: <circle cx="12" cy="12" r="8" />,
    undo: <><path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5" /></>,
  };
  return <svg className="wf-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function ActionComposer({ subject, kind, onSave }) {
  const id = useId();
  const [owner, setOwner] = useState('Portfolio team');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [saved, setSaved] = useState(false);
  const update = setter => event => { setter(event.target.value); setSaved(false); };

  function submit(event) {
    event.preventDefault();
    onSave({ subject, kind, owner, note: note.trim(), priority, dueDate: dueDate || null });
    setSaved(true);
  }

  return <form className="wf-composer" onSubmit={submit}>
    <div className="wf-field">
      <label htmlFor={`${id}-owner`}>Owner</label>
      <div className="wf-owner-field"><span className="wf-avatar" aria-hidden="true">{initials(owner)}</span><select id={`${id}-owner`} aria-label="Owner" value={owner} onChange={update(setOwner)}>{owners.map(name => <option key={name}>{name}</option>)}</select></div>
    </div>
    <div className="wf-field">
      <label htmlFor={`${id}-notes`}>Review notes <span>Optional</span></label>
      <textarea id={`${id}-notes`} aria-label="Review notes" value={note} onChange={update(setNote)} placeholder={kind === 'vendor' ? 'What needs to be reconciled?' : 'Record a decision or the next step…'} rows={3} maxLength={2000} />
    </div>
    <details className="wf-details">
      <summary><WorkflowIcon name="flag" size={14} />Priority &amp; due date <WorkflowIcon name="chevron" size={13} /></summary>
      <div className="wf-detail-fields">
        <div className="wf-field"><label htmlFor={`${id}-priority`}>Priority</label><select id={`${id}-priority`} value={priority} onChange={update(setPriority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></div>
        <div className="wf-field"><label htmlFor={`${id}-due`}>Due date <span>Optional</span></label><input id={`${id}-due`} type="date" value={dueDate} onChange={update(setDueDate)} /></div>
      </div>
    </details>
    <button className={`wf-primary ${saved ? 'is-saved' : ''}`} type="submit"><WorkflowIcon name={saved ? 'check' : 'clipboard'} />{saved ? 'Update review' : kind === 'vendor' ? 'Create follow-up' : 'Save study review'}{!saved && <WorkflowIcon name="arrow" size={15} />}</button>
    <p className={`wf-feedback ${saved ? 'is-saved' : ''}`} role="status">{saved ? <><WorkflowIcon name="check" size={13} />Saved to your review queue.</> : 'Saved in this demo tab. No notifications are sent.'}</p>
  </form>;
}

export function VendorAction({ vendors, onSave }) {
  const selected = vendors.length === 1;
  return <aside className={`wf-panel wf-vendor ${selected ? 'has-selection' : ''}`} aria-label="Vendor follow-up">
    <div className="wf-panel-kicker"><span className="wf-icon-box"><WorkflowIcon name="building" size={18} /></span><span>Spend follow-up</span>{selected && <span className="wf-live-dot" aria-label="Vendor selected" />}</div>
    <h3>{selected ? vendors[0] : 'From variance to action'}</h3>
    <p className="wf-panel-description">{selected ? 'Assign the reconciliation and record the next step.' : vendors.length > 1 ? 'Select one vendor to create a focused follow-up.' : 'Select a vendor in the chart to review its spend.'}</p>
    {selected ? <ActionComposer key={vendors[0]} subject={vendors[0]} kind="vendor" onSave={onSave} /> : <div className="wf-vendor-path" aria-label="Vendor review steps"><span><i>1</i> Select a vendor</span><span><i>2</i> Assign an owner</span><span><i>3</i> Track the follow-up</span></div>}
  </aside>;
}

function DueDate({ value, done }) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = !done && date < today;
  return <span className={`wf-due ${overdue ? 'is-overdue' : ''}`}><WorkflowIcon name="calendar" size={12} />{overdue ? 'Overdue · ' : 'Due '}{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>;
}

export function ReviewQueue({ actions, onToggle, onRemove, onPortfolio }) {
  const [filter, setFilter] = useState('open');
  const openCount = actions.filter(action => !action.done).length;
  const filters = [{ id: 'open', label: 'Open', count: openCount }, { id: 'completed', label: 'Completed', count: actions.length - openCount }, { id: 'all', label: 'All', count: actions.length }];
  const visible = actions.filter(action => filter === 'all' || (filter === 'completed' ? action.done : !action.done));

  return <section className="wf-panel wf-queue" aria-label="Review queue">
    <header className="wf-queue-header"><div><div className="wf-panel-kicker">Decisions &amp; next steps</div><h3>Review queue <span className="wf-count">{openCount}</span></h3></div><button className="wf-text-button" type="button" onClick={onPortfolio}>Review a study <WorkflowIcon name="arrow" size={14} /></button></header>
    <div className="wf-queue-toolbar"><div className="wf-status-filters" role="group" aria-label="Filter review queue">{filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{item.count}</span></button>)}</div><span className="wf-session-tag">This session</span></div>
    {visible.length === 0 ? <div className="wf-queue-empty"><span className="wf-empty-icon"><WorkflowIcon name={actions.length && filter === 'open' ? 'check' : 'clipboard'} size={23} /></span><div><h4>{!actions.length ? 'A place for the next step' : filter === 'completed' ? 'No completed reviews yet' : 'You’re up to date'}</h4><p>{!actions.length ? 'Select a study or vendor, then add a review. Your follow-ups will appear here.' : filter === 'completed' ? 'Complete an open review to move it here.' : 'Every review is complete. Select a study to start another.'}</p></div>{!actions.length && <button className="wf-secondary" type="button" onClick={onPortfolio}>Choose a study <WorkflowIcon name="arrow" size={14} /></button>}</div> : <div className="wf-queue-items">{visible.map(action => <article className={`wf-queue-item ${action.done ? 'is-complete' : ''}`} key={action.id}>
      <button type="button" className="wf-completion" aria-label={`${action.done ? 'Reopen' : 'Mark complete'}: ${action.subject}`} title={action.done ? 'Reopen review' : 'Mark complete'} aria-pressed={action.done} onClick={() => onToggle(action.id)}><WorkflowIcon name={action.done ? 'check' : 'circle'} size={18} /></button>
      <div className="wf-item-body"><div className="wf-item-meta"><span>{action.kind === 'vendor' ? 'Vendor follow-up' : 'Study review'}</span>{action.priority === 'high' && <span className="wf-priority"><WorkflowIcon name="flag" size={10} />High priority</span>}{action.done && <span className="wf-completed-label">Completed</span>}</div><h4>{action.subject}</h4>{action.note && <p>{action.note}</p>}<div className="wf-item-footer"><span className="wf-assignee"><span className="wf-avatar wf-avatar-small" aria-hidden="true">{initials(action.owner || 'Unassigned')}</span>{action.owner || 'Unassigned'}</span><DueDate value={action.dueDate} done={action.done} /></div></div>
      <button className="wf-remove" type="button" aria-label={`Remove review for ${action.subject}`} title="Remove review" onClick={() => onRemove(action.id)}><WorkflowIcon name="trash" size={14} /></button>
    </article>)}</div>}
    <footer className="wf-queue-footer"><span className="wf-session-dot" />Demo actions stay in this browser tab.</footer>
  </section>;
}
