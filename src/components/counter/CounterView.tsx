import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { 
  DiningTable, 
  TableSession, 
  ParcelOrder, 
  OrderTicket, 
  OrderItem, 
  Bill, 
  BillAdjustment, 
  MenuItem, 
  MenuCategory,
  StaffProfile
} from '../../types/database';
import { SessionsOverview } from './SessionsOverview';
import { CreateParcelModal } from './CreateParcelModal';
import { BillDetailModal } from './BillDetailModal';
import { ItemAdjustmentModal } from './ItemAdjustmentModal';
import { SettlementModal } from './SettlementModal';
import { HistoricalBillsView } from './HistoricalBillsView';
import { MenuManagementView } from './MenuManagementView';
import { TableManagementView } from './TableManagementView';
import { StaffManagementView } from './StaffManagementView';
import { AnalyticsDashboard } from './AnalyticsDashboard';


interface CounterViewProps {
  activeTab?: 'sessions' | 'history' | 'menu' | 'tables' | 'staff' | 'analytics';
  setActiveTab?: (tab: 'sessions' | 'history' | 'menu' | 'tables' | 'staff' | 'analytics') => void;
}

export const CounterView: React.FC<CounterViewProps> = ({
  activeTab: externalTab,
  setActiveTab: externalSetTab,
}) => {
  const [internalTab, setInternalTab] = useState<'sessions' | 'history' | 'menu' | 'tables' | 'staff' | 'analytics'>('sessions');
  const activeTab = externalTab ?? internalTab;
  const setActiveTab = externalSetTab ?? setInternalTab;

  const [tables, setTables] = useState<DiningTable[]>([]);
  const [tableSessions, setTableSessions] = useState<TableSession[]>([]);
  const [parcelOrders, setParcelOrders] = useState<ParcelOrder[]>([]);
  const [orders, setOrders] = useState<OrderTicket[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [adjustments, setAdjustments] = useState<BillAdjustment[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);

  // Modals
  const [showParcelModal, setShowParcelModal] = useState(false);
  const [selectedBillForDetail, setSelectedBillForDetail] = useState<{ bill: Bill; title: string } | null>(null);
  const [itemToAdjust, setItemToAdjust] = useState<OrderItem | null>(null);
  const [billToSettle, setBillToSettle] = useState<{ bill: Bill; title: string } | null>(null);

  const loadData = async () => {
    try {
      const [tList, sList, pList, oList, oiList, bList, baList, mList, cList, stList] = await Promise.all([
        api.getTables(),
        api.getTableSessions(),
        api.getParcelOrders(),
        api.getOrders(),
        api.getOrderItems(),
        api.getBills(),
        api.getBillAdjustments(),
        api.getMenuItems(),
        api.getMenuCategories(),
        api.getAllStaffProfiles(),
      ]);

      setTables(tList);
      setTableSessions(sList);
      setParcelOrders(pList);
      setOrders(oList);
      setOrderItems(oiList);
      setBills(bList);
      setAdjustments(baList);
      setMenuItems(mList);
      setCategories(cList);
      setStaffList(stList);
    } catch (err: unknown) {
      console.error('Error refreshing counter admin data:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to Realtime updates: Visual update ONLY without audible chime
    const unsubscribe = api.subscribe(() => {
      loadData();
    });

    return () => unsubscribe();
  }, []);

  const handleOpenBill = (bill: Bill, title: string) => {
    setSelectedBillForDetail({ bill, title });
  };

  const handleOpenAdjustment = (item: OrderItem) => {
    setItemToAdjust(item);
  };

  const handleOpenSettlement = () => {
    if (selectedBillForDetail) {
      setBillToSettle({ bill: selectedBillForDetail.bill, title: selectedBillForDetail.title });
      setSelectedBillForDetail(null);
    }
  };

  const activeBillItems = selectedBillForDetail
    ? orderItems.filter((oi) => 
        (selectedBillForDetail.bill.table_session_id && oi.table_session_id === selectedBillForDetail.bill.table_session_id) ||
        (selectedBillForDetail.bill.parcel_id && oi.parcel_id === selectedBillForDetail.bill.parcel_id)
      )
    : [];

  const activeBillAdjustments = selectedBillForDetail
    ? adjustments.filter((ba) => ba.bill_id === selectedBillForDetail.bill.id)
    : [];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {activeTab === 'sessions' && (
        <SessionsOverview
          tables={tables}
          tableSessions={tableSessions}
          parcelOrders={parcelOrders}
          bills={bills}
          orderItems={orderItems}
          onOpenBill={handleOpenBill}
          onCreateParcel={() => setShowParcelModal(true)}
        />
      )}

      {activeTab === 'history' && (
        <HistoricalBillsView
          bills={bills}
          tableSessions={tableSessions}
          parcelOrders={parcelOrders}
          tables={tables}
          orderItems={orderItems}
          adjustments={adjustments}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsDashboard
          bills={bills}
          orderItems={orderItems}
        />
      )}

      {activeTab === 'menu' && (
        <MenuManagementView
          menuItems={menuItems}
          categories={categories}
          onMenuUpdated={loadData}
        />
      )}

      {activeTab === 'tables' && (
        <TableManagementView
          tables={tables}
          tableSessions={tableSessions}
          onTablesUpdated={loadData}
        />
      )}

      {activeTab === 'staff' && (
        <StaffManagementView
          staffList={staffList}
          onStaffUpdated={loadData}
        />
      )}

      {/* Modals */}
      <CreateParcelModal
        isOpen={showParcelModal}
        onClose={() => setShowParcelModal(false)}
        menuItems={menuItems}
        categories={categories}
        onOrderCreated={loadData}
      />

      {selectedBillForDetail && (
        <BillDetailModal
          isOpen={true}
          onClose={() => setSelectedBillForDetail(null)}
          bill={selectedBillForDetail.bill}
          identifierTitle={selectedBillForDetail.title}
          orderItems={activeBillItems}
          adjustments={activeBillAdjustments}
          onOpenAdjustment={handleOpenAdjustment}
          onOpenSettlement={handleOpenSettlement}
        />
      )}

      {itemToAdjust && (
        <ItemAdjustmentModal
          isOpen={true}
          onClose={() => setItemToAdjust(null)}
          orderItem={itemToAdjust}
          onAdjustmentComplete={loadData}
        />
      )}

      {billToSettle && (
        <SettlementModal
          isOpen={true}
          onClose={() => setBillToSettle(null)}
          bill={billToSettle.bill}
          identifierTitle={billToSettle.title}
          onSettlementComplete={loadData}
        />
      )}
    </div>
  );
};
