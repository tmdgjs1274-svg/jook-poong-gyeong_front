import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function App() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState('pos');
  const [menus, setMenus] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState(null); 
  const [paymentType, setPaymentType] = useState('카드'); 
  const [orderDate, setOrderDate] = useState(getTodayStr()); 
  const [storeTags, setStoreTags] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedPosStore, setSelectedPosStore] = useState('전체');
  const [selectedMgmtStore, setSelectedMgmtStore] = useState('전체');

  // 일매출 정산 state
  const [dateList, setDateList] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [dailyOrders, setDailyOrders] = useState([]);
  const [filterStore, setFilterStore] = useState('전체');
  const [filterOrderType, setFilterOrderType] = useState('전체');
  const [filterPaymentType, setFilterPaymentType] = useState('전체'); // 결제수단 필터 추가
  
  // 주문 수정 모달 state
  const [editingOrderModal, setEditingOrderModal] = useState(null);

  // 메뉴/카테고리 관리 state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMenu, setNewMenu] = useState({ name: '', price: '', store_tag: '' });
  const [editingMenuModal, setEditingMenuModal] = useState(null);
  const [newStoreInput, setNewStoreInput] = useState('');
  const [newOrderTypeInput, setNewOrderTypeInput] = useState('');

  // 할인 입력 모달 state (POS용)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountName, setDiscountName] = useState('금액 할인');
  const [discountAmount, setDiscountAmount] = useState('');

  // 할인 입력 모달 state (주문 수정용)
  const [isEditDiscountModalOpen, setIsEditDiscountModalOpen] = useState(false);
  const [editDiscountName, setEditDiscountName] = useState('금액 할인');
  const [editDiscountAmount, setEditDiscountAmount] = useState('');

  const [draggedOrderIdx, setDraggedOrderIdx] = useState(null);
  const [draggedMenuIdx, setDraggedMenuIdx] = useState(null);
  const [draggedStoreIdx, setDraggedStoreIdx] = useState(null);
  const [draggedOrderTypeIdx, setDraggedOrderTypeIdx] = useState(null);

  // const API_BASE_URL = 'http://localhost:3000/api';
  const API_BASE_URL = 'https://jook-poong-gyeong.onrender.com/api';

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchDateList();
      fetchDailyOrders(selectedDate);
    }
  }, [activeTab, selectedDate]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const fetchInitialData = async () => {
    try {
      const [mRes, stRes, otRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/menus`),
        axios.get(`${API_BASE_URL}/store-tags`),
        axios.get(`${API_BASE_URL}/order-types`)
      ]);
      setMenus(mRes.data);
      setStoreTags(stRes.data);
      setOrderTypes(otRes.data);
      if (otRes.data.length > 0 && !orderType) {
        setOrderType(otRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDateList = () => {
    axios.get(`${API_BASE_URL}/sales/dates`).then(res => {
      setDateList(res.data);
      if (res.data.length > 0 && !res.data.includes(selectedDate)) {
        setSelectedDate(res.data[0]);
      }
    });
  };

  const fetchDailyOrders = (date) => {
    axios.get(`${API_BASE_URL}/sales/daily?date=${date}`).then(res => setDailyOrders(res.data));
  };

  const addToCart = (menu) => {
    setCart(prev => {
      const exist = prev.find(item => item.menu_id === menu.id && !item.isDiscount);
      if (exist) {
        return prev.map(item => item.menu_id === menu.id && !item.isDiscount ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { menu_id: menu.id, name: menu.name, price: menu.price, quantity: 1, isDiscount: false }];
    });
  };

  const addDiscountToCart = () => {
    const amt = Number(discountAmount);
    if (!amt || amt <= 0) return alert('유효한 할인 금액을 입력해주세요.');
    
    setCart(prev => [...prev, {
      menu_id: 0,
      name: discountName || '금액 할인',
      price: -amt,
      quantity: 1,
      isDiscount: true
    }]);

    setDiscountAmount('');
    setIsDiscountModalOpen(false);
    showToast('할인 항목이 추가되었습니다.');
  };

  const updateQuantity = (menuId, change, isDiscount) => {
    setCart(prev => prev.map(item => {
      if (item.menu_id === menuId && item.isDiscount === isDiscount) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (menuId, isDiscount) => {
    setCart(prev => prev.filter(item => !(item.menu_id === menuId && item.isDiscount === isDiscount)));
  };

  const handleOrder = async () => {
    if (cart.length === 0) return alert('선택된 메뉴가 없습니다!');
    if (!orderType) return alert('주문/배달 구분을 선택해주세요!');

    const totalAmount = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const payload = {
      store_id: 1,
      order_type_id: orderType,
      payment_type: paymentType,
      total_amount: totalAmount,
      items: cart.map(item => ({
        menu_id: item.menu_id === 0 ? null : item.menu_id,
        quantity: item.quantity,
        price: item.price
      })),
      created_at: orderDate
    };

    try {
      setIsSubmitting(true);
      await axios.post(`${API_BASE_URL}/orders`, payload);
      showToast('✅ 주문이 정상적으로 저장되었습니다.');
      setCart([]);
    } catch (err) {
      alert(`주문 저장 실패: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 가게/배달 구분 순서 변경 및 저장 함수 ---
  const handleStoreTagDrop = async (dragIdx, dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const newList = [...storeTags];
    const targetItem = newList[dragIdx];
    newList.splice(dragIdx, 1);
    newList.splice(dropIdx, 0, targetItem);
    setStoreTags(newList);
    setDraggedStoreIdx(null);

    try {
      await axios.put(`${API_BASE_URL}/store-tags/order`, { items: newList.map((item, index) => ({ id: item.id, display_order: index })) });
      showToast('가게 구분 순서가 저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('순서 저장 실패');
    }
  };

  const handleOrderTypeDrop = async (dragIdx, dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const newList = [...orderTypes];
    const targetItem = newList[dragIdx];
    newList.splice(dragIdx, 1);
    newList.splice(dropIdx, 0, targetItem);
    setOrderTypes(newList);
    setDraggedOrderTypeIdx(null);

    try {
      await axios.put(`${API_BASE_URL}/order-types/order`, { items: newList.map((item, index) => ({ id: item.id, display_order: index })) });
      showToast('배달 구분 순서가 저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('순서 저장 실패');
    }
  };

  const handleAddStoreTag = async () => {
    if (!newStoreInput) return;
    await axios.post(`${API_BASE_URL}/store-tags`, { name: newStoreInput });
    setNewStoreInput('');
    showToast('가게 구분이 추가되었습니다.');
    fetchInitialData();
  };

  const handleDeleteStoreTag = async (id) => {
    if (!window.confirm('이 가게 구분을 정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/store-tags/${id}`);
      showToast('가게 구분이 삭제되었습니다.');
      fetchInitialData();
    } catch (err) {
      alert('삭제 실패: 연관된 데이터가 있습니다.');
    }
  };

  const handleAddOrderType = async () => {
    if (!newOrderTypeInput) return;
    const res = await axios.post(`${API_BASE_URL}/order-types`, { name: newOrderTypeInput });
    setNewOrderTypeInput('');
    showToast('배달 구분이 추가되었습니다.');
    fetchInitialData();
    if (res.data && res.data[0]?.id) setOrderType(res.data[0].id);
  };

  const handleDeleteOrderType = async (id) => {
    if (!window.confirm('이 배달 구분을 정말 삭제하시겠습니까?')) return;
    await axios.delete(`${API_BASE_URL}/order-types/${id}`);
    showToast('배달 구분이 삭제되었습니다.');
    fetchInitialData();
  };

  const handleCreateMenu = async () => {
    if (!newMenu.name || !newMenu.price || !newMenu.store_tag) return alert('모든 항목을 입력해 주세요.');
    await axios.post(`${API_BASE_URL}/menus`, newMenu);
    showToast('✅ 새 메뉴가 등록되었습니다.');
    setIsCreateModalOpen(false);
    fetchInitialData();
  };

  const handleUpdateMenuModal = async () => {
    await axios.put(`${API_BASE_URL}/menus/${editingMenuModal.id}`, editingMenuModal);
    showToast('✅ 메뉴가 수정되었습니다.');
    setEditingMenuModal(null);
    fetchInitialData();
  };

  const handleDeleteMenu = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    await axios.delete(`${API_BASE_URL}/menus/${id}`);
    showToast('메뉴가 삭제되었습니다.');
    fetchInitialData();
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('주문 내역을 삭제하시겠습니까?')) return;
    await axios.delete(`${API_BASE_URL}/orders/${orderId}`);
    showToast('주문 내역이 삭제되었습니다.');
    fetchDailyOrders(selectedDate);
  };

  // --- 주문 수정 저장 함수 ---
  const handleUpdateOrderSubmit = async () => {
    if (!editingOrderModal) return;
    if (editingOrderModal.order_items.length === 0) return alert('선택된 메뉴가 없습니다!');

    const totalAmount = editingOrderModal.order_items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const payload = {
      store_id: 1,
      order_type_id: editingOrderModal.order_type_id,
      payment_type: editingOrderModal.payment_type,
      total_amount: totalAmount,
      items: editingOrderModal.order_items.map(item => ({
        menu_id: item.menu_id === 0 ? null : item.menu_id,
        quantity: item.quantity,
        price: item.price
      })),
      created_at: editingOrderModal.created_at.split('T')[0] // 날짜 반영
    };

    try {
      await axios.put(`${API_BASE_URL}/orders/${editingOrderModal.id}`, payload);
      showToast('✅ 주문이 수정되었습니다.');
      setEditingOrderModal(null);
      fetchDailyOrders(selectedDate);
      fetchDateList();
    } catch (err) {
      alert(`주문 수정 실패: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleGenericDrop = (list, setList, dragIdx, dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const newList = [...list];
    const targetItem = newList[dragIdx];
    newList.splice(dragIdx, 1);
    newList.splice(dropIdx, 0, targetItem);
    setList(newList);
  };

  const filteredDailyOrders = dailyOrders.filter(order => {
    const storeMatch = filterStore === '전체' || order.order_items.some(i => i.menus?.store_tag === filterStore);
    const typeMatch = filterOrderType === '전체' || order.order_types?.name === filterOrderType;
    const paymentMatch = filterPaymentType === '전체' || order.payment_type === filterPaymentType;
    return storeMatch && typeMatch && paymentMatch;
  });

  return (
    <div style={{ padding: '16px', fontFamily: "'Pretendard', sans-serif", backgroundColor: '#f4f6f8', minHeight: '100vh', color: '#333' }}>
      
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#1e293b', color: '#fff', padding: '12px 20px', borderRadius: '8px', zIndex: 9999, fontWeight: 'bold' }}>
          {toastMessage}
        </div>
      )}

      {/* 상단 네비게이션 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: '#fff', padding: '12px 20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setActiveTab('pos')} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'pos' ? '#2563eb' : '#f1f5f9', color: activeTab === 'pos' ? '#fff' : '#64748b' }}>주문 입력</button>
          <button onClick={() => setActiveTab('sales')} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'sales' ? '#2563eb' : '#f1f5f9', color: activeTab === 'sales' ? '#fff' : '#64748b' }}>일매출 정산</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setActiveTab('menuMgmt')} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'menuMgmt' ? '#10b981' : '#f1f5f9', color: activeTab === 'menuMgmt' ? '#fff' : '#64748b' }}>⚙️ 메뉴 관리</button>
          <button onClick={() => setActiveTab('categoryMgmt')} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'categoryMgmt' ? '#8b5cf6' : '#f1f5f9', color: activeTab === 'categoryMgmt' ? '#fff' : '#64748b' }}>🏷️ 가게/배달 관리</button>
        </div>
      </div>

      {/* 1. POS 영역 */}
      {activeTab === 'pos' && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 360px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px' }}>주문 내역</h2>
              <button onClick={() => setIsDiscountModalOpen(true)} style={{ padding: '6px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                🏷️ 금액 할인 추가
              </button>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>저장 일자</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>주문 / 배달 구분</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {orderTypes.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => setOrderType(ot.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      background: orderType === ot.id ? '#10b981' : '#f1f5f9',
                      color: orderType === ot.id ? '#fff' : '#64748b',
                      boxShadow: orderType === ot.id ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {ot.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>결제 구분</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['카드', '현금'].map(pt => (
                  <button
                    key={pt}
                    onClick={() => setPaymentType(pt)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '16px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      background: paymentType === pt ? '#10b981' : '#f1f5f9',
                      color: paymentType === pt ? '#fff' : '#64748b',
                    }}
                  >
                    {pt}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, minHeight: '180px', maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', textAlign: 'left', height: '36px' }}>
                    <th>메뉴 / 할인</th><th>수량</th><th style={{ textAlign: 'right' }}>금액</th><th style={{ textAlign: 'center', width: '50px' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', height: '44px', color: item.isDiscount ? '#dc2626' : '#333' }}>
                      <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                      <td>
                        {!item.isDiscount ? (
                          <>
                            <button onClick={() => updateQuantity(item.menu_id, -1, false)} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>-</button>
                            <span style={{ margin: '0 6px', fontWeight: 'bold' }}>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.menu_id, 1, false)} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>+</button>
                          </>
                        ) : (
                          <span>1</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{(item.price * item.quantity).toLocaleString()}원</td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => removeFromCart(item.menu_id, item.isDiscount)} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>총 결제 금액</span>
                <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#2563eb' }}>{cart.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()}원</span>
              </div>
              <button 
                onClick={handleOrder} 
                disabled={isSubmitting}
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  background: isSubmitting ? '#94a3b8' : '#10b981', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontSize: '16px', 
                  fontWeight: 'bold', 
                  cursor: isSubmitting ? 'not-allowed' : 'pointer' 
                }}
              >
                {isSubmitting ? '저장 중...' : '결제 및 주문 저장'}
              </button>
            </div>
          </div>

          <div style={{ flex: '3 1 500px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', overflowX: 'auto' }}>
              <button onClick={() => setSelectedPosStore('전체')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: selectedPosStore === '전체' ? '#0f172a' : '#f1f5f9', color: selectedPosStore === '전체' ? '#fff' : '#64748b', fontWeight: 'bold' }}>전체</button>
              {storeTags.map(tag => (
                <button key={tag.id} onClick={() => setSelectedPosStore(tag.name)} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: selectedPosStore === tag.name ? '#0f172a' : '#f1f5f9', color: selectedPosStore === tag.name ? '#fff' : '#64748b', fontWeight: 'bold' }}>{tag.name}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
              {menus.filter(m => selectedPosStore === '전체' || m.store_tag === selectedPosStore).map(m => (
                <button key={m.id} onClick={() => addToCart(m)} style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{m.store_tag || '미지정'}</span>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '8px', marginBottom: '4px' }}>{m.name}</div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>{m.price.toLocaleString()}원</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. 일매출 정산 */}
      {activeTab === 'sales' && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', maxWidth: '240px', background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '14px', fontSize: '16px' }}>일자 목록</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {dateList.map(date => (
                <button key={date} onClick={() => setSelectedDate(date)} style={{ padding: '12px', background: selectedDate === date ? '#2563eb' : '#f8fafc', color: selectedDate === date ? '#fff' : '#334155', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {date}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: '99 1 600px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>{selectedDate} 매출 상세 정보</h2>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '8px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', marginRight: '8px' }}>가게 구분:</span>
                <button onClick={() => setFilterStore('전체')} style={{ padding: '4px 10px', margin: '2px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', background: filterStore === '전체' ? '#2563eb' : '#e2e8f0', color: filterStore === '전체' ? '#fff' : '#334155' }}>전체</button>
                {storeTags.map(st => (
                  <button key={st.id} onClick={() => setFilterStore(st.name)} style={{ padding: '4px 10px', margin: '2px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', background: filterStore === st.name ? '#2563eb' : '#e2e8f0', color: filterStore === st.name ? '#fff' : '#334155' }}>{st.name}</button>
                ))}
              </div>
              <div>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', marginRight: '8px' }}>배달 구분:</span>
                <button onClick={() => setFilterOrderType('전체')} style={{ padding: '4px 10px', margin: '2px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', background: filterOrderType === '전체' ? '#2563eb' : '#e2e8f0', color: filterOrderType === '전체' ? '#fff' : '#334155' }}>전체</button>
                {orderTypes.map(ot => (
                  <button key={ot.id} onClick={() => setFilterOrderType(ot.name)} style={{ padding: '4px 10px', margin: '2px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', background: filterOrderType === ot.name ? '#2563eb' : '#e2e8f0', color: filterOrderType === ot.name ? '#fff' : '#334155' }}>{ot.name}</button>
                ))}
              </div>
              <div>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', marginRight: '8px' }}>결제 수단:</span>
                {['전체', '카드', '현금'].map(pt => (
                  <button key={pt} onClick={() => setFilterPaymentType(pt)} style={{ padding: '4px 10px', margin: '2px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', background: filterPaymentType === pt ? '#2563eb' : '#e2e8f0', color: filterPaymentType === pt ? '#fff' : '#334155' }}>{pt}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div style={{ flex: 1, background: '#eff6ff', padding: '16px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '13px', color: '#1e40af' }}>총 주문 건수</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e3a8a' }}>{filteredDailyOrders.length} 건</div>
              </div>
              <div style={{ flex: 1, background: '#ecfdf5', padding: '16px', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '13px', color: '#065f46' }}>총 매출 금액</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#064e3b' }}>{filteredDailyOrders.reduce((s, o) => s + o.total_amount, 0).toLocaleString()} 원</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', height: '40px', color: '#64748b' }}>
                    <th style={{ width: '40px' }}></th>
                    <th style={{ width: '130px' }}>주문일시</th>
                    <th style={{ width: '110px' }}>결제 수단</th>
                    <th style={{ width: '120px' }}>배달 구분</th>
                    <th style={{ textAlign: 'left', paddingLeft: '12px' }}>주문 상품 상세</th>
                    <th style={{ width: '100px' }}>총 금액</th>
                    <th style={{ width: '110px' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDailyOrders.map((order, idx) => {
                    const dateObj = new Date(order.created_at);
                    const formattedTime = !isNaN(dateObj.getTime()) 
                      ? `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`
                      : order.created_at;

                    return (
                      <tr 
                        key={order.id} 
                        draggable 
                        onDragStart={() => setDraggedOrderIdx(idx)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleGenericDrop(dailyOrders, setDailyOrders, draggedOrderIdx, idx)}
                        style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'center', height: '52px', background: '#fff', cursor: 'grab' }}
                      >
                        <td style={{ color: '#94a3b8', fontSize: '16px' }}>☰</td>
                        <td style={{ fontSize: '12px', color: '#64748b' }}>{formattedTime}</td>
                        <td>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            {order.payment_type || '카드'}
                          </span>
                        </td>
                        <td>
                          <span style={{ background: '#f1f5f9', color: '#334155', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            {order.order_types?.name || '매장'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'left', paddingLeft: '12px', fontWeight: '500' }}>
                          {order.order_items?.map(i => `${i.menus?.name || '할인/기타'}(${i.quantity}개)`).join(', ')}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{order.total_amount.toLocaleString()}원</td>
                        <td>
                          <button onClick={() => setEditingOrderModal({
                            ...order,
                            created_at: order.created_at ? order.created_at.split('T')[0] : getTodayStr(),
                            order_items: order.order_items.map(item => ({
                              menu_id: item.menu_id,
                              name: item.menus?.name || '할인/기타',
                              price: item.price,
                              quantity: item.quantity,
                              isDiscount: item.menu_id === null || item.price < 0
                            }))
                          })} style={{ marginRight: '4px', padding: '6px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>수정</button>
                          <button onClick={() => handleDeleteOrder(order.id)} style={{ padding: '6px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>삭제</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. 메뉴 관리 탭 */}
      {activeTab === 'menuMgmt' && (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>메뉴 세팅 및 관리</h2>
            <button onClick={() => { setNewMenu({ name: '', price: '', store_tag: '' }); setIsCreateModalOpen(true); }} style={{ padding: '10px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              + 새 메뉴 등록
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => setSelectedMgmtStore('전체')} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: selectedMgmtStore === '전체' ? '#2563eb' : '#f1f5f9', color: selectedMgmtStore === '전체' ? '#fff' : '#64748b', fontWeight: 'bold' }}>전체 보기</button>
            {storeTags.map(st => (
              <button key={st.id} onClick={() => setSelectedMgmtStore(st.name)} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: selectedMgmtStore === st.name ? '#2563eb' : '#f1f5f9', color: selectedMgmtStore === st.name ? '#fff' : '#64748b', fontWeight: 'bold' }}>{st.name}</button>
            ))}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', height: '40px', color: '#64748b' }}>
                <th style={{ width: '40px' }}></th>
                <th>가게 구분</th><th>메뉴명</th><th>가격</th><th>관리</th>
              </tr>
            </thead>
            <tbody>
              {menus.filter(m => selectedMgmtStore === '전체' || m.store_tag === selectedMgmtStore).map((m, idx) => (
                <tr 
                  key={m.id} 
                  draggable 
                  onDragStart={() => setDraggedMenuIdx(idx)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleGenericDrop(menus, setMenus, draggedMenuIdx, idx)}
                  style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'center', height: '48px', cursor: 'grab' }}
                >
                  <td style={{ color: '#94a3b8', fontSize: '16px' }}>☰</td>
                  <td><span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{m.store_tag || '미지정'}</span></td>
                  <td style={{ fontWeight: 'bold' }}>{m.name}</td>
                  <td>{m.price.toLocaleString()}원</td>
                  <td>
                    <button onClick={() => setEditingMenuModal({ ...m })} style={{ marginRight: '6px', padding: '6px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>수정</button>
                    <button onClick={() => handleDeleteMenu(m.id)} style={{ padding: '6px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. 가게/배달 관리 탭 */}
      {activeTab === 'categoryMgmt' && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>가게 구분 관리</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input placeholder="예: 3호점, 강남점" value={newStoreInput} onChange={e => setNewStoreInput(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button onClick={handleAddStoreTag} style={{ padding: '10px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>추가</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {storeTags.map((st, idx) => (
                <div 
                  key={st.id} 
                  draggable 
                  onDragStart={() => setDraggedStoreIdx(idx)} 
                  onDragOver={e => e.preventDefault()} 
                  onDrop={() => handleStoreTagDrop(draggedStoreIdx, idx)} 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'grab' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ color: '#94a3b8' }}>☰</span><span style={{ fontWeight: 'bold' }}>{st.name}</span></div>
                  <button onClick={() => handleDeleteStoreTag(st.id)} style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>삭제</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '300px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>배달 구분 관리</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input placeholder="예: 배달의민족, 쿠팡이츠" value={newOrderTypeInput} onChange={e => setNewOrderTypeInput(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button onClick={handleAddOrderType} style={{ padding: '10px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>추가</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {orderTypes.map((ot, idx) => (
                <div 
                  key={ot.id} 
                  draggable 
                  onDragStart={() => setDraggedOrderTypeIdx(idx)} 
                  onDragOver={e => e.preventDefault()} 
                  onDrop={() => handleOrderTypeDrop(draggedOrderTypeIdx, idx)} 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'grab' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ color: '#94a3b8' }}>☰</span><span style={{ fontWeight: 'bold' }}>{ot.name}</span></div>
                  <button onClick={() => handleDeleteOrderType(ot.id)} style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>삭제</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* POS용 할인 모달 */}
      {isDiscountModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>🏷️ 금액 할인 추가</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>할인 명칭</label>
              <input type="text" value={discountName} onChange={e => setDiscountName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>할인 금액 (원)</label>
              <input type="number" placeholder="예: 2000" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsDiscountModalOpen(false)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
              <button onClick={addDiscountToCart} style={{ flex: 1, padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 주문 수정용 할인 모달 */}
      {isEditDiscountModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>🏷️ 주문 수정 - 금액 할인 추가</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>할인 명칭</label>
              <input type="text" value={editDiscountName} onChange={e => setEditDiscountName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>할인 금액 (원)</label>
              <input type="number" placeholder="예: 2000" value={editDiscountAmount} onChange={e => setEditDiscountAmount(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsEditDiscountModalOpen(false)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
              <button onClick={() => {
                const amt = Number(editDiscountAmount);
                if (!amt || amt <= 0) return alert('유효한 할인 금액을 입력해주세요.');
                setEditingOrderModal(prev => ({
                  ...prev,
                  order_items: [...prev.order_items, { menu_id: 0, name: editDiscountName || '금액 할인', price: -amt, quantity: 1, isDiscount: true }]
                }));
                setEditDiscountAmount('');
                setIsEditDiscountModalOpen(false);
              }} style={{ flex: 1, padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 주문 상세 수정 모달 */}
      {editingOrderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '550px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>✏️ 주문 상세 수정</h3>
              <button onClick={() => setIsEditDiscountModalOpen(true)} style={{ padding: '6px 12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                🏷️ 금액 할인 추가
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>저장 일자</label>
              <input type="date" value={editingOrderModal.created_at} onChange={e => setEditingOrderModal({ ...editingOrderModal, created_at: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>주문 / 배달 구분</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {orderTypes.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => setEditingOrderModal({ ...editingOrderModal, order_type_id: ot.id })}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      background: editingOrderModal.order_type_id === ot.id ? '#10b981' : '#f1f5f9',
                      color: editingOrderModal.order_type_id === ot.id ? '#fff' : '#64748b'
                    }}
                  >
                    {ot.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>결제 구분</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['카드', '현금'].map(pt => (
                  <button
                    key={pt}
                    onClick={() => setEditingOrderModal({ ...editingOrderModal, payment_type: pt })}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '16px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      background: editingOrderModal.payment_type === pt ? '#10b981' : '#f1f5f9',
                      color: editingOrderModal.payment_type === pt ? '#fff' : '#64748b'
                    }}
                  >
                    {pt}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>주문 상품 목록</label>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', textAlign: 'left', height: '36px' }}>
                    <th>상품명 / 할인</th><th>수량</th><th style={{ textAlign: 'right' }}>금액</th><th style={{ textAlign: 'center', width: '50px' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {editingOrderModal.order_items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', height: '44px', color: item.isDiscount ? '#dc2626' : '#333' }}>
                      <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                      <td>
                        {!item.isDiscount ? (
                          <>
                            <button onClick={() => {
                              setEditingOrderModal(prev => ({
                                ...prev,
                                order_items: prev.order_items.map((it, i) => i === idx && it.quantity > 1 ? { ...it, quantity: it.quantity - 1 } : it)
                              }));
                            }} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>-</button>
                            <span style={{ margin: '0 6px', fontWeight: 'bold' }}>{item.quantity}</span>
                            <button onClick={() => {
                              setEditingOrderModal(prev => ({
                                ...prev,
                                order_items: prev.order_items.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it)
                              }));
                            }} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>+</button>
                          </>
                        ) : (
                          <span>1</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{(item.price * item.quantity).toLocaleString()}원</td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => {
                          setEditingOrderModal(prev => ({
                            ...prev,
                            order_items: prev.order_items.filter((_, i) => i !== idx)
                          }));
                        }} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderTop: '2px solid #f1f5f9', paddingTop: '12px' }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>수정된 총 금액</span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb' }}>
                {editingOrderModal.order_items.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()}원
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditingOrderModal(null)} style={{ flex: 1, padding: '12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
              <button onClick={handleUpdateOrderSubmit} style={{ flex: 1, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 새 메뉴 등록 모달 */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '360px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>새 메뉴 등록</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>가게 구분</label>
              <select value={newMenu.store_tag} onChange={e => setNewMenu({ ...newMenu, store_tag: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                <option value="">선택해주세요</option>
                {storeTags.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>메뉴명</label>
              <input placeholder="예: 소고기죽" value={newMenu.name} onChange={e => setNewMenu({ ...newMenu, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>가격</label>
              <input type="number" placeholder="예: 10000" value={newMenu.price} onChange={e => setNewMenu({ ...newMenu, price: Number(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
              <button onClick={handleCreateMenu} style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>등록</button>
            </div>
          </div>
        </div>
      )}

      {/* 메뉴 수정 모달 */}
      {editingMenuModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '360px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>메뉴 수정</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>가게 구분</label>
              <select value={editingMenuModal.store_tag} onChange={e => setEditingMenuModal({ ...editingMenuModal, store_tag: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                <option value="">선택해주세요</option>
                {storeTags.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>메뉴명</label>
              <input value={editingMenuModal.name} onChange={e => setEditingMenuModal({ ...editingMenuModal, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>가격</label>
              <input type="number" value={editingMenuModal.price} onChange={e => setEditingMenuModal({ ...editingMenuModal, price: Number(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditingMenuModal(null)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
              <button onClick={handleUpdateMenuModal} style={{ flex: 1, padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>수정</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}