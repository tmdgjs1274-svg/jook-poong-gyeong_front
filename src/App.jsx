import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function App() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState('pos');
  const [menus, setMenus] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState(1);
  const [orderDate, setOrderDate] = useState(getTodayStr()); // POS 저장일자 (기본: 오늘)
  const [storeTags, setStoreTags] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);

  // Toast 메시지 state
  const [toastMessage, setToastMessage] = useState('');

  // 탭 제어 state
  const [selectedPosStore, setSelectedPosStore] = useState('전체');
  const [selectedMgmtStore, setSelectedMgmtStore] = useState('전체');

  // 일매출 정산 state
  const [dateList, setDateList] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [dailyOrders, setDailyOrders] = useState([]);
  const [filterStore, setFilterStore] = useState('전체');
  const [filterOrderType, setFilterOrderType] = useState('전체');
  const [editingOrder, setEditingOrder] = useState(null);
  const [editModalStoreFilter, setEditModalStoreFilter] = useState('전체'); // 수정 모달 전용 가게필터

  // 메뉴 관리 state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMenu, setNewMenu] = useState({ name: '', price: '', store_tag: '' });
  const [editingMenuModal, setEditingMenuModal] = useState(null);

  // 카테고리 관리 state
  const [newStoreInput, setNewStoreInput] = useState('');
  const [newOrderTypeInput, setNewOrderTypeInput] = useState('');

  // Drag & Drop용 state
  const [draggedOrderIdx, setDraggedOrderIdx] = useState(null);
  const [draggedMenuIdx, setDraggedMenuIdx] = useState(null);
  const [draggedStoreIdx, setDraggedStoreIdx] = useState(null);
  const [draggedOrderTypeIdx, setDraggedOrderTypeIdx] = useState(null);

  //const API_BASE_URL = 'http://localhost:3000/api';
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
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
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
      if (otRes.data.length > 0 && !orderType) setOrderType(otRes.data[0].id);
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

  // 장바구니 관련
  const addToCart = (menu) => {
    setCart(prev => {
      const exist = prev.find(item => item.menu_id === menu.id);
      if (exist) {
        return prev.map(item => item.menu_id === menu.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { menu_id: menu.id, name: menu.name, price: menu.price, quantity: 1 }];
    });
  };

  const updateQuantity = (menuId, change) => {
    setCart(prev => prev.map(item => {
      if (item.menu_id === menuId) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (menuId) => {
    if (!window.confirm('선택한 품목을 장바구니에서 삭제하시겠습니까?')) return;
    setCart(prev => prev.filter(item => item.menu_id !== menuId));
  };

  // ----------------------------------------------------
  // 주문 저장 함수 (상세 에러 출력 로직 보완)
  // ----------------------------------------------------
  const handleOrder = async () => {
    if (cart.length === 0) return alert('선택된 메뉴가 없습니다!');
    if (!window.confirm(`[${orderDate}] 일자로 주문을 저장하시겠습니까?`)) return;

    const totalAmount = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const payload = {
      store_id: 1,
      order_type_id: orderType,
      total_amount: totalAmount,
      items: cart.map(item => ({
        menu_id: item.menu_id,
        quantity: item.quantity,
        price: item.price
      })),
      created_at: orderDate
    };

    try {
      await axios.post(`${API_BASE_URL}/orders`, payload);
      showToast('✅ 주문이 정상적으로 저장되었습니다.');
      setCart([]);
    } catch (err) {
      console.error('주문 저장 에러 상세:', err.response?.data || err.message);
      
      // 서버에서 전달한 구체적인 에러 메시지 추출
      const serverError = err.response?.data;
      let errorMsg = '서버 내부 오류(500)';
      
      if (typeof serverError === 'string') {
        errorMsg = serverError;
      } else if (serverError?.message) {
        errorMsg = serverError.message;
      } else if (serverError?.error) {
        errorMsg = serverError.error;
      }

      alert(`주문 저장 실패:\n${errorMsg}`);
    }
  };

  // 등록 / 수정 / 삭제 관리
  const handleAddStoreTag = async () => {
    if (!newStoreInput) return;
    if (!window.confirm(`'${newStoreInput}' 가게 구분을 추가하시겠습니까?`)) return;
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
    if (!window.confirm(`'${newOrderTypeInput}' 배달 구분을 추가하시겠습니까?`)) return;
    await axios.post(`${API_BASE_URL}/order-types`, { name: newOrderTypeInput });
    setNewOrderTypeInput('');
    showToast('배달 구분이 추가되었습니다.');
    fetchInitialData();
  };

  const handleDeleteOrderType = async (id) => {
    if (!window.confirm('이 배달 구분을 정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/order-types/${id}`);
      showToast('배달 구분이 삭제되었습니다.');
      fetchInitialData();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const handleCreateMenu = async () => {
    if (!newMenu.name || !newMenu.price) return alert('메뉴명과 가격을 입력해 주세요.');
    if (!newMenu.store_tag) return alert('가게 구분을 선택해 주세요.');
    if (!window.confirm('새 메뉴를 등록하시겠습니까?')) return;

    await axios.post(`${API_BASE_URL}/menus`, newMenu);
    showToast('✅ 새 메뉴가 등록되었습니다.');
    setIsCreateModalOpen(false);
    fetchInitialData();
  };

  const handleUpdateMenuModal = async () => {
    if (!editingMenuModal.name || !editingMenuModal.price) return alert('메뉴명과 가격을 입력해 주세요.');
    if (!editingMenuModal.store_tag) return alert('가게 구분을 선택해 주세요.');
    if (!window.confirm('메뉴 정보를 수정하시겠습니까?')) return;

    await axios.put(`${API_BASE_URL}/menus/${editingMenuModal.id}`, editingMenuModal);
    showToast('✅ 메뉴가 수정되었습니다.');
    setEditingMenuModal(null);
    fetchInitialData();
  };

  const handleDeleteMenu = async (id) => {
    if (!window.confirm('이 메뉴를 정말 삭제하시겠습니까?')) return;
    await axios.delete(`${API_BASE_URL}/menus/${id}`);
    showToast('메뉴가 삭제되었습니다.');
    fetchInitialData();
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('이 주문 내역을 정말 삭제하시겠습니까?')) return;
    await axios.delete(`${API_BASE_URL}/orders/${orderId}`);
    showToast('주문 내역이 삭제되었습니다.');
    fetchDailyOrders(selectedDate);
  };

  // 일매출 수정 관련
  const openEditModal = (order) => {
    const formattedItems = order.order_items.map(i => ({
      menu_id: i.menu_id || 0,
      name: i.menus?.name || '삭제된 메뉴',
      price: i.price,
      quantity: i.quantity
    }));
    setEditModalStoreFilter('전체');
    setEditingOrder({ ...order, cart: formattedItems, editDate: selectedDate });
  };

  const removeItemFromEditModal = (menuId) => {
    if (!window.confirm('선택한 품목을 주문 목록에서 삭제하시겠습니까?')) return;
    setEditingOrder(prev => ({
      ...prev,
      cart: prev.cart.filter(i => i.menu_id !== menuId)
    }));
  };

  const addItemToEditModal = (menu) => {
    setEditingOrder(prev => {
      const exist = prev.cart.find(i => i.menu_id === menu.id);
      if (exist) {
        return { ...prev, cart: prev.cart.map(i => i.menu_id === menu.id ? { ...i, quantity: i.quantity + 1 } : i) };
      }
      return { ...prev, cart: [...prev.cart, { menu_id: menu.id, name: menu.name, price: menu.price, quantity: 1 }] };
    });
  };

  const handleSaveEditedOrder = async () => {
    if (!window.confirm('주문 수정 사항을 저장하시겠습니까?')) return;
    const totalAmount = editingOrder.cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    await axios.put(`${API_BASE_URL}/orders/${editingOrder.id}`, {
      order_type_id: editingOrder.order_type_id,
      total_amount: totalAmount,
      items: editingOrder.cart,
      created_at: editingOrder.editDate
    });
    showToast('✅ 주문 수정이 완료되었습니다.');
    setEditingOrder(null);
    fetchDailyOrders(selectedDate);
  };

  // Generic Drag & Drop Helper
  const handleGenericDrop = (list, setList, dragIdx, dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const newList = [...list];
    const targetItem = newList[dragIdx];
    newList.splice(dragIdx, 1);
    newList.splice(dropIdx, 0, targetItem);
    setList(newList);
    showToast('순서가 변경되었습니다.');
  };

  const filteredDailyOrders = dailyOrders.filter(order => {
    const storeMatch = filterStore === '전체' || order.order_items.some(i => i.menus?.store_tag === filterStore);
    const typeMatch = filterOrderType === '전체' || order.order_types?.name === filterOrderType;
    return storeMatch && typeMatch;
  });

  return (
    <div style={{ padding: '16px', fontFamily: "'Pretendard', sans-serif", backgroundColor: '#f4f6f8', minHeight: '100vh', color: '#333' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#1e293b', color: '#fff', padding: '12px 20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 9999, fontWeight: 'bold' }}>
          {toastMessage}
        </div>
      )}

      {/* Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: '#fff', padding: '12px 20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setActiveTab('pos')} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'pos' ? '#2563eb' : '#f1f5f9', color: activeTab === 'pos' ? '#fff' : '#64748b' }}>주문 입력 (POS)</button>
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
          <div style={{ flex: '1 1 340px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>주문 내역</h2>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>저장 일자</label>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>주문 / 배달 구분</label>
                <select value={orderType} onChange={e => setOrderType(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                  {orderTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: '220px', maxHeight: '380px', overflowY: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', textAlign: 'left', height: '36px' }}>
                    <th>메뉴</th><th>수량</th><th style={{ textAlign: 'right' }}>금액</th><th style={{ textAlign: 'center', width: '50px' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.menu_id} style={{ borderBottom: '1px solid #f8fafc', height: '44px' }}>
                      <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                      <td>
                        <button onClick={() => updateQuantity(item.menu_id, -1)} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>-</button>
                        <span style={{ margin: '0 6px', fontWeight: 'bold' }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.menu_id, 1)} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>+</button>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{(item.price * item.quantity).toLocaleString()}원</td>
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => removeFromCart(item.menu_id)} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>삭제</button>
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
              <button onClick={handleOrder} style={{ width: '100%', padding: '14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>결제 및 주문 저장</button>
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
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold', marginRight: '8px' }}>주문/배달:</span>
                <button onClick={() => setFilterOrderType('전체')} style={{ padding: '4px 10px', margin: '2px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', background: filterOrderType === '전체' ? '#2563eb' : '#e2e8f0', color: filterOrderType === '전체' ? '#fff' : '#334155' }}>전체</button>
                {orderTypes.map(ot => (
                  <button key={ot.id} onClick={() => setFilterOrderType(ot.name)} style={{ padding: '4px 10px', margin: '2px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '12px', background: filterOrderType === ot.name ? '#2563eb' : '#e2e8f0', color: filterOrderType === ot.name ? '#fff' : '#334155' }}>{ot.name}</button>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '550px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', height: '40px', color: '#64748b' }}>
                    <th style={{ width: '40px' }}></th>
                    <th style={{ width: '100px' }}>구분</th>
                    <th style={{ textAlign: 'left', paddingLeft: '12px' }}>주문 상품 상세</th>
                    <th style={{ width: '120px' }}>총 금액</th>
                    <th style={{ width: '120px' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDailyOrders.map((order, idx) => (
                    <tr 
                      key={order.id} 
                      draggable 
                      onDragStart={() => setDraggedOrderIdx(idx)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleGenericDrop(dailyOrders, setDailyOrders, draggedOrderIdx, idx)}
                      style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'center', height: '52px', background: '#fff', cursor: 'grab' }}
                    >
                      <td style={{ color: '#94a3b8', fontSize: '16px' }}>☰</td>
                      <td><span style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{order.order_types?.name || '매장'}</span></td>
                      <td style={{ textAlign: 'left', paddingLeft: '12px', fontWeight: '500' }}>
                        {order.order_items?.map(i => `${i.menus?.name || '기존삭제메뉴'}(${i.quantity}개)`).join(', ')}
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{order.total_amount.toLocaleString()}원</td>
                      <td>
                        <button onClick={() => openEditModal(order)} style={{ marginRight: '6px', padding: '6px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>수정</button>
                        <button onClick={() => handleDeleteOrder(order.id)} style={{ padding: '6px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>삭제</button>
                      </td>
                    </tr>
                  ))}
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
          {/* 가게 구분 */}
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
                  onDrop={() => handleGenericDrop(storeTags, setStoreTags, draggedStoreIdx, idx)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'grab' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#94a3b8' }}>☰</span>
                    <span style={{ fontWeight: 'bold' }}>{st.name}</span>
                  </div>
                  <button onClick={() => handleDeleteStoreTag(st.id)} style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>삭제</button>
                </div>
              ))}
            </div>
          </div>

          {/* 배달 구분 */}
          <div style={{ flex: 1, minWidth: '300px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>배달 구분 관리</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input placeholder="예: 배달의민족, 요기요" value={newOrderTypeInput} onChange={e => setNewOrderTypeInput(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button onClick={handleAddOrderType} style={{ padding: '10px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>추가</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {orderTypes.map((ot, idx) => (
                <div 
                  key={ot.id} 
                  draggable 
                  onDragStart={() => setDraggedOrderTypeIdx(idx)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleGenericDrop(orderTypes, setOrderTypes, draggedOrderTypeIdx, idx)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'grab' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#94a3b8' }}>☰</span>
                    <span style={{ fontWeight: 'bold' }}>{ot.name}</span>
                  </div>
                  <button onClick={() => handleDeleteOrderType(ot.id)} style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>삭제</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 모달 1: 새 메뉴 등록 */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px' }}>새 메뉴 등록</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>메뉴명</label>
                <input placeholder="메뉴명 입력" value={newMenu.name} onChange={e => setNewMenu({ ...newMenu, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>가격</label>
                <input type="number" placeholder="가격 입력" value={newMenu.price} onChange={e => setNewMenu({ ...newMenu, price: e.target.value === '' ? '' : Number(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>가게 구분</label>
                <select value={newMenu.store_tag} onChange={e => setNewMenu({ ...newMenu, store_tag: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                  <option value="">가게 구분 선택</option>
                  {storeTags.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ padding: '10px 18px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>취소</button>
              <button onClick={handleCreateMenu} style={{ padding: '10px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>등록 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 2: 메뉴 수정 */}
      {editingMenuModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px' }}>메뉴 정보 수정</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>메뉴명</label>
                <input value={editingMenuModal.name} onChange={e => setEditingMenuModal({ ...editingMenuModal, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>가격</label>
                <input type="number" value={editingMenuModal.price} onChange={e => setEditingMenuModal({ ...editingMenuModal, price: e.target.value === '' ? '' : Number(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>가게 구분</label>
                <select value={editingMenuModal.store_tag || ''} onChange={e => setEditingMenuModal({ ...editingMenuModal, store_tag: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                  <option value="">가게 구분 선택</option>
                  {storeTags.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingMenuModal(null)} style={{ padding: '10px 18px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>취소</button>
              <button onClick={handleUpdateMenuModal} style={{ padding: '10px 18px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>수정 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 3: 일매출 정산 - 수정 팝업 */}
      {editingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>✏️ 주문 상세 내역 수정</h3>
              <button onClick={() => setEditingOrder(null)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>저장 일자</label>
                <input type="date" value={editingOrder.editDate} onChange={e => setEditingOrder({ ...editingOrder, editDate: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>주문/배달 구분</label>
                <select value={editingOrder.order_type_id} onChange={e => setEditingOrder({ ...editingOrder, order_type_id: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                  {orderTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155' }}>선택 품목</h4>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', minHeight: '220px', maxHeight: '280px', overflowY: 'auto' }}>
                  {editingOrder.cart.map(item => (
                    <div key={item.menu_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{(item.price * item.quantity).toLocaleString()}원</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => setEditingOrder({ ...editingOrder, cart: editingOrder.cart.map(i => i.menu_id === item.menu_id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i) })} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>-</button>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.quantity}</span>
                        <button onClick={() => setEditingOrder({ ...editingOrder, cart: editingOrder.cart.map(i => i.menu_id === item.menu_id ? { ...i, quantity: i.quantity + 1 } : i) })} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>+</button>
                        <button onClick={() => removeItemFromEditModal(item.menu_id)} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', marginLeft: '4px', fontWeight: 'bold' }}>삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: '1 1 260px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#334155' }}>메뉴 추가</h4>
                
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  <button onClick={() => setEditModalStoreFilter('전체')} style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: editModalStoreFilter === '전체' ? '#2563eb' : '#e2e8f0', color: editModalStoreFilter === '전체' ? '#fff' : '#334155', fontWeight: 'bold' }}>전체</button>
                  {storeTags.map(st => (
                    <button key={st.id} onClick={() => setEditModalStoreFilter(st.name)} style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: editModalStoreFilter === st.name ? '#2563eb' : '#e2e8f0', color: editModalStoreFilter === st.name ? '#fff' : '#334155', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{st.name}</button>
                  ))}
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', minHeight: '180px', maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {menus.filter(m => editModalStoreFilter === '전체' || m.store_tag === editModalStoreFilter).map(m => (
                    <button key={m.id} onClick={() => addItemToEditModal(m)} style={{ padding: '8px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: '500' }}>
                      <span>+ {m.name}</span>
                      <span style={{ color: '#64748b' }}>{m.price.toLocaleString()}원</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>최종 수정 금액</span>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb' }}>
                  {editingOrder.cart.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()} 원
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setEditingOrder(null)} style={{ padding: '10px 18px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>취소</button>
                <button onClick={handleSaveEditedOrder} style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>수정 저장</button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}