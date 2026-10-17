import React, { useState } from 'react';
import { api } from '../../lib/api';
import { MenuItem, MenuCategory } from '../../types/database';
import { formatPaiseToINR, rupeesToPaise, paiseToRupees } from '../../lib/currency';
import { Plus, Edit2, Archive, RotateCcw, Trash2, Check, X, AlertCircle } from 'lucide-react';

interface MenuManagementViewProps {
  menuItems: MenuItem[];
  categories: MenuCategory[];
  onMenuUpdated: () => void;
}

export const MenuManagementView: React.FC<MenuManagementViewProps> = ({
  menuItems,
  categories,
  onMenuUpdated,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [showAddDishModal, setShowAddDishModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // New Dish Form State
  const [newDishName, setNewDishName] = useState('');
  const [newDishCategoryId, setNewDishCategoryId] = useState(categories[0]?.id || '');
  const [newDishPriceRupees, setNewDishPriceRupees] = useState<number | string>('');
  
  // New Category State
  const [newCategoryName, setNewCategoryName] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');

  const filteredItems = menuItems.filter((m) => {
    if (selectedCategoryId !== 'all' && m.category_id !== selectedCategoryId) return false;
    return true;
  });

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim() || !newDishCategoryId || !newDishPriceRupees) return;
    setErrorMessage('');
    try {
      const pricePaise = rupeesToPaise(newDishPriceRupees);
      await api.createMenuItem({
        name: newDishName.trim(),
        category_id: newDishCategoryId,
        price_paise: pricePaise,
        is_available: true,
      });

      setNewDishName('');
      setNewDishPriceRupees('');
      setShowAddDishModal(false);
      setNoticeMessage('New dish added to menu successfully.');
      onMenuUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUpdateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setErrorMessage('');
    try {
      await api.updateMenuItem(editingItem.id, {
        name: editingItem.name,
        price_paise: editingItem.price_paise,
        category_id: editingItem.category_id,
        is_available: editingItem.is_available,
      });

      setEditingItem(null);
      setNoticeMessage(`Dish "${editingItem.name}" updated. Future orders will use this updated price.`);
      onMenuUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await api.updateMenuItem(item.id, { is_available: !item.is_available });
      onMenuUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleArchive = async (item: MenuItem) => {
    try {
      await api.updateMenuItem(item.id, { is_archived: !item.is_archived });
      onMenuUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSafeDelete = async (item: MenuItem) => {
    if (!confirm(`Are you sure you want to remove "${item.name}"? If referenced historically, it will be safely archived.`)) {
      return;
    }
    try {
      const res = await api.safeDeleteMenuItem(item.id);
      if (res.reason) {
        setNoticeMessage(res.reason);
      }
      onMenuUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await api.createCategory(newCategoryName.trim());
      setNewCategoryName('');
      setShowAddCategoryModal(false);
      onMenuUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Menu & Category Management</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Configure dishes, prices, availability and operational food categories
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn-secondary" onClick={() => setShowAddCategoryModal(true)}>
            <Plus size={14} />
            Add Category
          </button>
          <button type="button" className="btn-primary" onClick={() => setShowAddDishModal(true)}>
            <Plus size={14} />
            Add New Dish
          </button>
        </div>
      </div>

      {noticeMessage && (
        <div className="alert-banner alert-banner-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{noticeMessage}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setNoticeMessage('')} style={{ border: 'none' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="alert-banner alert-banner-danger">
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Category selector pills */}
      <div className="panel" style={{ padding: '10px 14px', marginBottom: '14px', display: 'flex', gap: '6px', overflowX: 'auto' }}>
        <button
          type="button"
          className={`btn-sm ${selectedCategoryId === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedCategoryId('all')}
        >
          All Categories ({menuItems.length})
        </button>
        {categories.map((c) => {
          const count = menuItems.filter((m) => m.category_id === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              className={`btn-sm ${selectedCategoryId === c.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCategoryId(c.id)}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Dishes Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Dish Name</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Current Price</th>
              <th style={{ textAlign: 'center' }}>Availability</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((dish) => (
              <tr key={dish.id} style={{ opacity: dish.is_archived ? 0.6 : 1 }}>
                <td style={{ fontWeight: 600 }}>
                  {dish.name}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {categoryMap.get(dish.category_id) || 'General'}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>
                  {formatPaiseToINR(dish.price_paise)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className={`btn-sm ${dish.is_available ? 'btn-success' : 'btn-danger'}`}
                    style={{ minHeight: '26px', fontSize: '11px', padding: '2px 8px' }}
                    onClick={() => handleToggleAvailability(dish)}
                    disabled={dish.is_archived}
                    title={dish.is_available ? 'Click to mark unavailable for waiters' : 'Click to enable dish'}
                  >
                    {dish.is_available ? 'Available' : 'Unavailable'}
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {dish.is_archived ? (
                    <span className="badge badge-settled">Archived</span>
                  ) : (
                    <span className="badge badge-ready">Active</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      style={{ padding: '4px' }}
                      onClick={() => setEditingItem(dish)}
                      title="Edit dish name or price"
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      style={{ padding: '4px' }}
                      onClick={() => handleToggleArchive(dish)}
                      title={dish.is_archived ? 'Restore to active menu' : 'Archive dish'}
                    >
                      {dish.is_archived ? <RotateCcw size={13} color="var(--success)" /> : <Archive size={13} />}
                    </button>

                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      style={{ padding: '4px' }}
                      onClick={() => handleSafeDelete(dish)}
                      title="Safely remove or archive dish"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Dish */}
      {showAddDishModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Add New Menu Dish</h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowAddDishModal(false)} style={{ border: 'none' }}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreateDish}>
              <div className="modal-body">
                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="dish-name-input">Dish Name</label>
                  <input
                    id="dish-name-input"
                    type="text"
                    placeholder="e.g. Garlic Naan"
                    value={newDishName}
                    onChange={(e) => setNewDishName(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="dish-category-select">Category</label>
                  <select
                    id="dish-category-select"
                    value={newDishCategoryId}
                    onChange={(e) => setNewDishCategoryId(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="dish-price-input">Price in Rupees (₹)</label>
                  <input
                    id="dish-price-input"
                    type="number"
                    min="1"
                    step="0.5"
                    placeholder="e.g. 60"
                    value={newDishPriceRupees}
                    onChange={(e) => setNewDishPriceRupees(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddDishModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Dish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Dish */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Edit Dish: {editingItem.name}</h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setEditingItem(null)} style={{ border: 'none' }}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleUpdateDish}>
              <div className="modal-body">
                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="edit-dish-name">Dish Name</label>
                  <input
                    id="edit-dish-name"
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="edit-dish-cat">Category</label>
                  <select
                    id="edit-dish-cat"
                    value={editingItem.category_id}
                    onChange={(e) => setEditingItem({ ...editingItem, category_id: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="edit-dish-price">Price in Rupees (₹)</label>
                  <input
                    id="edit-dish-price"
                    type="number"
                    min="1"
                    step="0.5"
                    value={paiseToRupees(editingItem.price_paise)}
                    onChange={(e) => setEditingItem({ ...editingItem, price_paise: rupeesToPaise(e.target.value) })}
                    style={{ width: '100%' }}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Notice: Price changes take effect for future orders only. Historical bills preserve their snapshot prices.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingItem(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Category */}
      {showAddCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Create Food Category</h3>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowAddCategoryModal(false)} style={{ border: 'none' }}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="modal-body">
                <div>
                  <label htmlFor="cat-name-input">Category Name</label>
                  <input
                    id="cat-name-input"
                    type="text"
                    placeholder="e.g. Tandoor Specials"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddCategoryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
