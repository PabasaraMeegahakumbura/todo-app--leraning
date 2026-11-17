import { useEffect, useRef, useState } from 'react';

async function request(path, options) {
    const response = await fetch(path, options);
    if (!response.ok) throw new Error('Could not save your change. Please try again.');
    return options?.method === 'DELETE' ? null : response.json();
}

function App() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState('');
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState([]);
    const [notice, setNotice] = useState('');
    const input = useRef(null);
    const pending = useRef(new Set());

    async function load() {
        setLoading(true);
        setError('');
        try { setItems(await request('/api/items')); }
        catch { setError('Your tasks could not be loaded. Check your connection and retry.'); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(); }, []);

    const completed = items.filter((item) => item.completed).length;
    const remaining = items.length - completed;
    const progress = items.length ? Math.round(completed / items.length * 100) : 0;
    const visible = items.filter((item) =>
        (filter === 'all' || (filter === 'done' ? item.completed : !item.completed)) &&
        item.name.toLowerCase().includes(search.toLowerCase()),
    );
    const tabs = [['all', 'All tasks', items.length], ['active', 'In progress', remaining], ['done', 'Completed', completed]];

    async function add(event) {
        event.preventDefault();
        const name = draft.trim();
        if (!name || adding) return;
        setAdding(true);
        setError('');
        try {
            const item = await request('/api/items', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            setItems((previous) => [...previous, item]);
            setDraft(''); setFilter('all'); setSearch('');
            setNotice('Task added. One step closer.');
            input.current?.focus();
        } catch (failure) { setError(failure.message); }
        finally { setAdding(false); }
    }

    async function change(item, remove = false) {
        if (pending.current.has(item.id)) return;
        pending.current.add(item.id);
        setBusy([...pending.current]); setError('');
        try {
            const updated = await request(`/api/items/${encodeURIComponent(item.id)}`, {
                method: remove ? 'DELETE' : 'PUT',
                ...(!remove && { headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: item.name, completed: !item.completed }) }),
            });
            setItems((previous) => remove ? previous.filter((entry) => entry.id !== item.id)
                : previous.map((entry) => entry.id === item.id ? updated : entry));
            setNotice(remove ? 'Task deleted.' : updated.completed ? 'Task completed. Nicely done!' : 'Task moved to in progress.');
        } catch (failure) { setError(failure.message); }
        finally { pending.current.delete(item.id); setBusy([...pending.current]); }
    }

    return (
        <div className="workspace">
            <aside className="sidebar" aria-label="Workspace navigation">
                <a className="brand" href="#main"><span className="brand-mark" aria-hidden="true">✓</span> clear<span>day</span></a>
                <div className="workspace-label">YOUR WORKSPACE</div>
                <nav aria-label="Task views">{tabs.map(([value, label, count]) => (
                    <button key={value} className={`nav-item ${filter === value ? 'selected' : ''}`} onClick={() => setFilter(value)} aria-pressed={filter === value}>
                        <span className="nav-symbol" aria-hidden="true">{value === 'all' ? '▦' : value === 'active' ? '◷' : '✓'}</span>
                        {label}<span className="nav-count">{loading ? '–' : count}</span>
                    </button>
                ))}</nav>
                <div className="sidebar-note"><span aria-hidden="true">✳</span><h2>Small steps.<br />Clearer days.</h2><p>You don’t have to do it all.<br />Just the next thing.</p></div>
                <div className="workspace-footer"><span className="avatar" aria-hidden="true">Y</span><div>Your workspace<small>A little room to focus</small></div></div>
            </aside>
            <main id="main" className="main-content">
                <header className="topbar"><span>Workspace <span aria-hidden="true">/</span> <strong>My tasks</strong></span><span>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date())}</span></header>
                <div className="page-content">
                    <section className="page-heading"><div><p className="eyebrow">MAKE SPACE FOR WHAT MATTERS</p><h1>A little focus.<br />A lot of possibility.</h1><p className="intro">Get it out of your head and into a clearer day.</p></div><div className="sun-art" aria-hidden="true"><span>✳</span></div></section>
                    <section className="summary" aria-label="Task overview">
                        <div><span className="stat-label">On your list</span><strong>{loading ? '–' : items.length}<small>tasks</small></strong></div>
                        <div><span className="stat-label">Still to do</span><strong>{loading ? '–' : remaining}<small>one at a time</small></strong></div>
                        <div className="progress-stat"><span className="stat-label">Look at you go <b>{progress}%</b></span><div className="progress-track" role="progressbar" aria-label="Tasks completed" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><small>{completed} of {items.length} completed</small></div>
                    </section>
                    <section className="task-panel" aria-labelledby="task-title">
                        <div className="panel-heading"><h2 id="task-title">Your next steps <span>{items.length}</span></h2><label className="search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a task…" aria-label="Search tasks" /></label></div>
                        <form className="add-form" onSubmit={add}><span aria-hidden="true">＋</span><input ref={input} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={255} placeholder="What would you like to get done?" aria-label="New task" disabled={loading || adding} /><button className="primary-button" disabled={loading || adding || !draft.trim()}>{adding ? 'Adding…' : 'Add task'} <span aria-hidden="true">↗</span></button></form>
                        <div className="filter-bar" aria-label="Filter tasks">{tabs.map(([value, label, count]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}<span>{count}</span></button>)}</div>
                        {error && <div className="error-message" role="alert">{error} <button onClick={load} disabled={loading || adding || busy.length > 0}>Reload tasks</button></div>}
                        <div className="task-list" aria-busy={loading}>
                            {loading ? <div className="empty-state" role="status">Getting your day ready…</div> : visible.length ? visible.map((item) => <div key={item.id} className={`task-row ${item.completed ? 'completed' : ''}`}>
                                <input className="task-check" type="checkbox" checked={item.completed} disabled={loading || busy.includes(item.id)} onChange={() => change(item)} aria-label={`${item.completed ? 'Mark incomplete' : 'Complete'}: ${item.name}`} />
                                <span className="task-name">{item.name}</span><span className="status-tag">{item.completed ? 'Done' : 'To do'}</span>
                                <button className="delete-button" disabled={loading || busy.includes(item.id)} onClick={() => change(item, true)} aria-label={`Delete task: ${item.name}`}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" /></svg></button>
                            </div>) : <div className="empty-state"><span aria-hidden="true">{search ? '⌕' : '✓'}</span><h3>{search ? 'No matching tasks' : filter === 'done' ? 'Good things take small steps' : filter === 'active' && items.length ? 'A little breathing room' : 'A fresh start awaits'}</h3><p>{search ? 'Try another search or clear the search box.' : filter === 'done' ? 'Completed tasks will appear here.' : filter === 'active' && items.length ? 'You’ve completed everything on your list.' : 'Add your first task above. Keep it simple.'}</p></div>}
                        </div>
                        <footer className="list-footer"><span>{remaining} task{remaining !== 1 ? 's' : ''} left to do</span><span>Progress, not perfection.</span></footer>
                    </section>
                    <p className="page-footer">A clearer list. A lighter mind.</p>
                    <span className="sr-only" role="status" aria-live="polite">{notice}</span>
                </div>
            </main>
        </div>
    );
}
export default App;
