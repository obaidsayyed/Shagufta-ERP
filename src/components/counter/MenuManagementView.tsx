import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../lib/api';
import { MenuItem, MenuCategory } from '../../types/database';
import { formatPaiseToINR, rupeesToPaise, paiseToRupees } from '../../lib/currency';
import { Plus, Edit2, Archive, RotateCcw, Trash2, Check, X, AlertCircle, Upload, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // New Dish Form State
  const [newDishName, setNewDishName] = useState('');
  const [newDishCategoryId, setNewDishCategoryId] = useState(categories[0]?.id || '');
  const [newDishPriceRupees, setNewDishPriceRupees] = useState<number | string>('');
  
  // New Category State
  const [newCategoryName, setNewCategoryName] = useState('');

  // Bulk File Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<Array<{ name: string; category: string; pricePaise: number; priceRupees: number }>>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const resetImportState = () => {
    setImportFile(null);
    setParsedItems([]);
    setImportErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadSample = () => {
    const csvContent = 'name,category,price\nButter Chicken,Main Course,320\nPaneer Tikka,Starters,240\nGarlic Naan,Breads,60\nMango Lassi,Beverages,90\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'menu_items_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportErrors([]);
    setParsedItems([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result as ArrayBuffer;
        if (!data) throw new Error('Could not read file data.');
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setImportErrors(['No sheets found in the file.']);
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (!rawRows || rawRows.length === 0) {
          setImportErrors(['The uploaded file is empty.']);
          return;
        }

        // Normalize string to match headers regardless of order or formatting
        const normalize = (str: any) =>
          String(str || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, '');

        let headerRowIdx = -1;
        let nameIdx = -1;
        let catIdx = -1;
        let priceIdx = -1;

        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const row = rawRows[r];
          if (!Array.isArray(row)) continue;

          let foundName = -1;
          let foundCat = -1;
          let foundPrice = -1;

          row.forEach((cell, idx) => {
            const norm = normalize(cell);
            if (!norm) return;
            if (norm === 'name' || norm === 'dish' || norm === 'dishname' || norm === 'item' || norm === 'itemname') {
              foundName = idx;
            } else if (
              norm === 'category' ||
              norm === 'cateogory' ||
              norm === 'cat' ||
              norm === 'categoryname' ||
              norm === 'itemcategory'
            ) {
              foundCat = idx;
            } else if (
              norm === 'price' ||
              norm === 'rate' ||
              norm === 'cost' ||
              norm === 'amount' ||
              norm === 'priceinr' ||
              norm === 'pricers'
            ) {
              foundPrice = idx;
            }
          });

          if (foundName !== -1 && foundCat !== -1 && foundPrice !== -1) {
            headerRowIdx = r;
            nameIdx = foundName;
            catIdx = foundCat;
            priceIdx = foundPrice;
            break;
          }
        }

        if (headerRowIdx === -1) {
          setImportErrors([
            "Could not detect all 3 required columns: 'name', 'category', and 'price'. Please ensure your file includes these column headers (column order does not matter).",
          ]);
          return;
        }

        const items: Array<{ name: string; category: string; pricePaise: number; priceRupees: number }> = [];
        const errors: string[] = [];

        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || !Array.isArray(row)) continue;

          const rawName = String(row[nameIdx] ?? '').trim();
          const rawCat = String(row[catIdx] ?? '').trim();
          const rawPrice = row[priceIdx];

          // Skip empty rows
          if (!rawName && !rawCat && (rawPrice === '' || rawPrice === undefined || rawPrice === null)) {
            continue;
          }

          const rowNum = r + 1;

          if (!rawName) {
            errors.push(`Row ${rowNum}: Dish name is empty.`);
            continue;
          }

          if (!rawCat) {
            errors.push(`Row ${rowNum} ("${rawName}"): Category is empty.`);
            continue;
          }

          const priceClean = String(rawPrice ?? '').replace(/[^0-9.]/g, '');
          const priceNum = parseFloat(priceClean);

          if (isNaN(priceNum) || priceNum <= 0) {
            errors.push(`Row ${rowNum} ("${rawName}"): Invalid or missing price (${rawPrice}).`);
            continue;
          }

          items.push({
            name: rawName,
            category: rawCat,
            pricePaise: rupeesToPaise(priceNum),
            priceRupees: priceNum,
          });
        }

        if (items.length === 0 && errors.length === 0) {
          errors.push('No data rows found below the header row.');
        }

        setParsedItems(items);
        setImportErrors(errors);
      } catch (err: unknown) {
        setImportErrors([err instanceof Error ? err.message : 'Failed to parse file. Please verify CSV/Excel formatting.']);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleExecuteImport = async () => {
    if (parsedItems.length === 0 || isImporting) return;
    setIsImporting(true);
    setErrorMessage('');

    try {
      // 1. Fetch current categories
      const currentCats = await api.getMenuCategories();
      const catMap = new Map<string, string>(
        currentCats.map((c) => [c.name.toLowerCase().trim(), c.id])
      );

      // 2. Auto-create any missing categories
      const distinctCats = Array.from(new Set(parsedItems.map((item) => item.category.trim())));
      let newCatsCreated = 0;
      for (const catName of distinctCats) {
        const key = catName.toLowerCase();
        if (!catMap.has(key)) {
          const newCat = await api.createCategory(catName);
          catMap.set(key, newCat.id);
          newCatsCreated++;
        }
      }

      // 3. Create all menu items
      let addedCount = 0;
      for (const item of parsedItems) {
        const catId = catMap.get(item.category.toLowerCase().trim())!;
        await api.createMenuItem({
          name: item.name,
          category_id: catId,
          price_paise: item.pricePaise,
          is_available: true,
        });
        addedCount++;
      }

      // 4. Success feedback and refresh
      setShowImportModal(false);
      resetImportState();
      setNoticeMessage(
        `Successfully imported ${addedCount} dishes${newCatsCreated > 0 ? ` and created ${newCatsCreated} new categories` : ''} into the menu!`
      );
      onMenuUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  };

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Menu & Category Management</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Configure dishes, prices, availability and operational food categories
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={() => setShowImportModal(true)}>
            <Upload size={14} />
            Add via File (CSV / Excel)
          </button>
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

      {/* Category selector pills - wrapped to prevent horizontal scrolling */}
      <div className="panel" style={{ padding: '8px 10px', marginBottom: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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

      {/* Modal: Add Menu Items via File (CSV / Excel) */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={18} color="var(--emerald-green)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Import Menu Items via File</h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Upload CSV or Excel (.xlsx, .xls) with 3 columns: name, category, and price
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setShowImportModal(false);
                  resetImportState();
                }}
                style={{ border: 'none' }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
              {/* Instructions & Sample Download */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '14px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <strong>Required Columns:</strong> <code style={{ backgroundColor: 'var(--bg-surface)', padding: '2px 5px', borderRadius: '4px' }}>name</code>,{' '}
                  <code style={{ backgroundColor: 'var(--bg-surface)', padding: '2px 5px', borderRadius: '4px' }}>category</code>,{' '}
                  <code style={{ backgroundColor: 'var(--bg-surface)', padding: '2px 5px', borderRadius: '4px' }}>price</code> (order doesn't matter)
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={handleDownloadSample}
                  style={{ fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Download size={13} />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              {/* Upload Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-strong)',
                  borderRadius: '10px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: importFile ? 'rgba(4, 106, 56, 0.04)' : 'var(--bg-surface)',
                  borderColor: importFile ? 'var(--emerald-green)' : 'var(--border-strong)',
                  transition: 'all 0.2s ease',
                  marginBottom: '16px',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <Upload size={28} style={{ margin: '0 auto 8px', color: importFile ? 'var(--emerald-green)' : 'var(--text-muted)' }} />
                {importFile ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--emerald-green)' }}>
                      {importFile.name}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {(importFile.size / 1024).toFixed(1)} KB &bull; Click to choose another file
                    </span>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      Click to choose CSV or Excel file
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Supports .csv, .xlsx, .xls with name, category, price columns
                    </span>
                  </div>
                )}
              </div>

              {/* Error messages if any */}
              {importErrors.length > 0 && (
                <div className="alert-banner alert-banner-danger" style={{ marginBottom: '14px', display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontWeight: 700 }}>
                    <AlertCircle size={15} />
                    <span>File Issues Detected</span>
                  </div>
                  <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '11.5px', lineHeight: 1.5 }}>
                    {importErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Parsed Items Preview */}
              {parsedItems.length > 0 && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} color="var(--emerald-green)" />
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>
                        Ready to Import ({parsedItems.length} dishes)
                      </span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Categories: {Array.from(new Set(parsedItems.map((i) => i.category))).join(', ')}
                    </span>
                  </div>

                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                  >
                    <table style={{ margin: 0, fontSize: '12px' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-surface-elevated)' }}>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                          <th>Dish Name</th>
                          <th>Category</th>
                          <th style={{ textAlign: 'right' }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedItems.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600 }}>{item.name}</td>
                            <td>
                              <span className="badge badge-settled" style={{ fontSize: '10px' }}>
                                {item.category}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {formatPaiseToINR(item.pricePaise)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 20px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowImportModal(false);
                  resetImportState();
                }}
                disabled={isImporting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleExecuteImport}
                disabled={parsedItems.length === 0 || isImporting}
                style={{ minWidth: '160px' }}
              >
                {isImporting ? 'Importing Dishes...' : `Import ${parsedItems.length} Dishes`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
