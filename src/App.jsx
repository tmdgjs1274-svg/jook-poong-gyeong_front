import React, { useState, useEffect } from 'react';
import axios from 'axios';

// 백엔드 API 기본 주소
const API_BASE_URL = 'http://localhost:3000';

export default function App() {
  const [currentTab, setCurrentTab] = useState('order'); // 'order', 'sales', 'menu', 'store'
  
  // 마스터 데이터
  const [menus, setMenus] = useState([]);
  const [storeTags, setStoreTags] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);

  // 주문 입력 상태
  const [selectedStoreTag, setSelectedStoreTag] = useState(null);
  const [selectedOrderType, setSelectedOrderType] = useState(null);
  const [paymentType, setPaymentType] = useState('카드'); // '카드' 또는 '현금'
  const [orderItems, setOrderItems] = useState([]); 
  const [discountAmount, setDiscountAmount] = useState(''); 

  // 일매출 정산 상태
  const [salesDates, setSalesDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [dailyOrders, setDailyOrders] = useState([]);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState('전체');
  const [selectedOrderTypeFilter, setSelectedOrderTypeFilter] = useState('전체');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState('전체'); // 결제 수단 필터 (카드/현금)

  // 주문 수정 모달 상태
  const [editingOrder, setEditingOrder] = useState(null);
  const [editDiscountInput, setEditDiscountInput] = useState('');

  // 설정 탭 상태
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuStoreTagId, setNewMenuStoreTagId] = useState('');
  
  const [newStoreTagName, setNewStoreTagName] = useState('');
  const [newOrderTypeName, setNewOrderTypeName] = useState('');

  // 초기 데이터 로드
  useEffect(() => {
    fetchMetaData();
  }, []);

  const fetchMetaData = async () => {
    try {
      const [menuRes, storeRes, typeRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/menus`),
        axios.get(`${API_BASE_URL}/api/store-tags`),
        axios.get(`${API_BASE_URL}/api/order-types`)
      ]);
      setMenus(menuRes.data);
      setStoreTags(storeRes.data);
      setOrderTypes(typeRes.data);

      if (storeRes.data.length > 0 && !selectedStoreTag) setSelectedStoreTag(storeRes.data[0].id);
      if (typeRes.data.length > 0 && !selectedOrderType) setSelectedOrderType(typeRes.data[0].id);
    } catch (err) {
      console.error('초기 데이터 로딩 실패:', err);
    }
  };

  useEffect(() => {
    if (currentTab === 'sales') {
      fetchSalesDates();
    }
  }, [currentTab]);

  const fetchSalesDates = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/sales/dates`);
      setSalesDates(res.data);
      if (res.data.length > 0 && !selectedDate) {
        setSelectedDate(res.data[0]);
      }
    } catch (err) {
      console.error('매출 날짜 조회 실패:', err);
    }
  };

  useEffect(() => {
    if (selectedDate && currentTab === 'sales') {
      fetchDailySales(selectedDate);
    }
  }, [selectedDate]);

  const fetchDailySales = async (date) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/sales/daily?date=${date}`);
      setDailyOrders(res.data);
    } catch (err) {
      console.error('일일 매출 조회 실패:', err);
    }
  };

  // 메뉴 담기 (주문 입력용)
  const handleAddToCart = (menu) => {
    setOrderItems(prev => {
      const existing = prev.find(item => item.menu_id === menu.id);
      if (existing) {
        return prev.map(item => 
          item.menu_id === menu.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prev, { menu_id: menu.id, name: menu.name, price: menu.price, quantity: 1 }];
      }
    });
  };

  // 수량 변경 (주문 입력용)
  const handleQuantityChange = (menu_id, delta) => {
    setOrderItems(prev => {
      return prev.map(item => {
        if (item.menu_id === menu_id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  // 금액 할인 추가 (주문 입력용)
  const handleAddCustomDiscount = () => {
    if (!discountAmount || isNaN(discountAmount) || Number(discountAmount) <= 0) {
      alert('올바른 할인 금액을 입력해주세요.');
      return;
    }
    const dAmount = Number(discountAmount);
    setOrderItems(prev => [
      ...prev,
      { menu_id: 0, name: `할인/기타`, price: -dAmount, quantity: 1 }
    ]);
    setDiscountAmount('');
  };

  const calculatedTotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // 주문 전송
  const handleSubmitOrder = async () => {
    if (orderItems.length === 0) {
      alert('주문할 상품을 선택해주세요.');
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/orders`, {
        store_id: selectedStoreTag,
        order_type_id: selectedOrderType,
        payment_type: paymentType,
        total_amount: calculatedTotal,
        items: orderItems
      });
      alert('주문이 완료되었습니다!');
      setOrderItems([]);
    } catch (err) {
      console.error('주문 실패:', err);
      alert('주문 저장 중 오류가 발생했습니다.');
    }
  };

  // 주문 삭제
  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('정말 이 주문을 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/orders/${orderId}`);
      fetchDailySales(selectedDate);
    } catch (err) {
      console.error('주문 삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 주문 수정 저장
  const handleUpdateOrderSubmit = async () => {
    if (!editingOrder) return;
    try {
      const newTotal = editingOrder.order_items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      await axios.delete(`${API_BASE_URL}/api/orders/${editingOrder.id}`);
      await axios.post(`${API_BASE_URL}/api/orders`, {
        store_id: editingOrder.store_id,
        order_type_id: editingOrder.order_type_id,
        payment_type: editingOrder.payment_type,
        total_amount: newTotal,
        items: editingOrder.order_items.map(i => ({
          menu_id: i.menu_id,
          quantity: i.quantity,
          price: i.price
        })),
        created_at: editingOrder.created_at
      });

      alert('주문이 수정되었습니다.');
      setEditingOrder(null);
      fetchDailySales(selectedDate);
    } catch (err) {
      console.error('주문 수정 실패:', err);
      alert('주문 수정 중 오류가 발생했습니다.');
    }
  };

  // --- 관리자: 메뉴, 가게/배달 관리 및 순서 변경(저장) ---
  const handleAddMenu = async (e) => {
    e.preventDefault();
    if (!newMenuName || !newMenuPrice || !newMenuStoreTagId) {
      alert('모든 항목을 입력해주세요.');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/menus`, {
        name: newMenuName,
        price: Number(newMenuPrice),
        store_tag_id: Number(newMenuStoreTagId)
      });
      setNewMenuName('');
      setNewMenuPrice('');
      fetchMetaData();
      alert('메뉴가 추가되었습니다.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMenu = async (id) => {
    if (!window.confirm('메뉴를 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/menus/${id}`);
      fetchMetaData();
    } catch (err) {
      console.error(err);
    }
  };

  // 가게/배달 구분 추가
  const handleAddStoreTag = async (e) => {
    e.preventDefault();
    if (!newStoreTagName) return;
    try {
      await axios.post(`${API_BASE_URL}/api/store-tags`, { name: newStoreTagName, order_index: storeTags.length });
      setNewStoreTagName('');
      fetchMetaData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStoreTag = async (id) => {
    if (!window.confirm('가게 구분을 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/store-tags/${id}`);
      fetchMetaData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddOrderType = async (e) => {
    e.preventDefault();
    if (!newOrderTypeName) return;
    try {
      await axios.post(`${API_BASE_URL}/api/order-types`, { name: newOrderTypeName, order_index: orderTypes.length });
      setNewOrderTypeName('');
      fetchMetaData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteOrderType = async (id) => {
    if (!window.confirm('배달 구분을 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/order-types/${id}`);
      fetchMetaData();
    } catch (err) {
      console.error(err);
    }
  };

  // 순서 위로/아래로 이동 및 저장
  const handleMoveOrderIndex = async (list, setList, index, direction, type) => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const newList = [...list];
    const temp = newList[index];
    newList[index] = newList[targetIdx];
    newList[targetIdx] = temp;

    setList(newList);

    // 서버에 순서 변경 사항 일괄 저장 API 호출 또는 개별 업데이트
    try {
      const endpoint = type === 'store' ? 'store-tags' : 'order-types';
      await Promise.all(
        newList.map((item, idx) => 
          axios.put(`${API_BASE_URL}/api/${endpoint}/${item.id}`, { name: item.name, order_index: idx })
        )
      );
      fetchMetaData();
    } catch (err) {
      console.error('순서 저장 실패:', err);
      alert('순서 저장 중 오류가 발생했습니다.');
    }
  };

  const filteredMenus = menus.filter(m => m.store_tag_id === Number(selectedStoreTag));

  // 일매출 필터링 적용 (가게, 배달, 결제수단 각각 쪼개진 필터)
  const filteredDailyOrders = dailyOrders.filter(order => {
    const storeObj = storeTags.find(s => s.id === order.store_id);
    const storeName = storeObj ? storeObj.name : '';
    const orderTypeName = order.order_types ? order.order_types.name : '';
    const payType = order.payment_type || '카드';

    const matchStore = selectedStoreFilter === '전체' || storeName === selectedStoreFilter;
    const matchType = selectedOrderTypeFilter === '전체' || orderTypeName === selectedOrderTypeFilter;
    const matchPayment = selectedPaymentFilter === '전체' || payType === selectedPaymentFilter;

    return matchStore && matchType && matchPayment;
  });

  const totalFilteredSalesAmount = filteredDailyOrders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'sans-serif', padding: '20px' }}>
      {/* 상단 네비게이션 탭 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #dee2e6', paddingBottom: '15px' }}>
        <button 
          onClick={() => setCurrentTab('order')}
          style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: currentTab === 'order' ? '#007bff' : '#e9ecef', color: currentTab === 'order' ? '#fff' : '#495057', border: 'none', borderRadius: '5px' }}>
          주문 입력
        </button>
        <button 
          onClick={() => setCurrentTab('sales')}
          style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: currentTab === 'sales' ? '#007bff' : '#e9ecef', color: currentTab === 'sales' ? '#fff' : '#495057', border: 'none', borderRadius: '5px' }}>
          일매출 정산
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setCurrentTab('menu')}
            style={{ padding: '10px 15px', fontSize: '14px', cursor: 'pointer', backgroundColor: currentTab === 'menu' ? '#6c757d' : '#e9ecef', color: currentTab === 'menu' ? '#fff' : '#495057', border: 'none', borderRadius: '5px' }}>
            ⚙️ 메뉴 관리
          </button>
          <button 
            onClick={() => setCurrentTab('store')}
            style={{ padding: '10px 15px', fontSize: '14px', cursor: 'pointer', backgroundColor: currentTab === 'store' ? '#6c757d' : '#e9ecef', color: currentTab === 'store' ? '#fff' : '#495057', border: 'none', borderRadius: '5px' }}>
            🏷️ 가게/배달 관리
          </button>
        </div>
      </div>

      {/* [1] 주문 입력 탭 */}
      {currentTab === 'order' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              {storeTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedStoreTag(tag.id)}
                  style={{
                    padding: '10px 20px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                    backgroundColor: selectedStoreTag === tag.id ? '#343a40' : '#fff',
                    color: selectedStoreTag === tag.id ? '#fff' : '#343a40',
                    border: '1px solid #ced4da', borderRadius: '5px'
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {filteredMenus.map(menu => (
                <button
                  key={menu.id}
                  onClick={() => handleAddToCart(menu)}
                  style={{
                    padding: '20px 10px', backgroundColor: '#fff', border: '1px solid #ced4da',
                    borderRadius: '8px', cursor: 'pointer', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>{menu.name}</div>
                  <div style={{ fontSize: '14px', color: '#007bff' }}>{menu.price.toLocaleString()}원</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <h3>주문 내역</h3>
            
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '5px' }}>주문/배달 구분</label>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {orderTypes.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => setSelectedOrderType(ot.id)}
                    style={{
                      padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
                      backgroundColor: selectedOrderType === ot.id ? '#007bff' : '#f1f3f5',
                      color: selectedOrderType === ot.id ? '#fff' : '#495057',
                      border: 'none', borderRadius: '4px'
                    }}
                  >
                    {ot.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '5px' }}>결제 수단</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['카드', '현금'].map(type => (
                  <button
                    key={type}
                    onClick={() => setPaymentType(type)}
                    style={{
                      flex: 1, padding: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
                      backgroundColor: paymentType === type ? '#28a745' : '#f1f3f5',
                      color: paymentType === type ? '#fff' : '#495057',
                      border: 'none', borderRadius: '4px'
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
              <label style={{ fontSize: '13px', color: '#495057', display: 'block', marginBottom: '5px' }}>금액 할인 (원 단위 입력)</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input 
                  type="number" 
                  value={discountAmount} 
                  onChange={(e) => setDiscountAmount(e.target.value)} 
                  placeholder="예: 2000"
                  style={{ flex: 1, padding: '6px', fontSize: '14px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
                <button 
                  onClick={handleAddCustomDiscount}
                  style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                >
                  할인 적용
                </button>
              </div>
            </div>

            <div style={{ minHeight: '150px', maxHeight: '250px', overflowY: 'auto', borderTop: '1px solid #dee2e6', borderBottom: '1px solid #dee2e6', padding: '10px 0', marginBottom: '15px' }}>
              {orderItems.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#adb5bd', marginTop: '50px' }}>선택된 메뉴가 없습니다.</p>
              ) : (
                orderItems.map((item, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '14px' }}>
                    <div style={{ flex: 1 }}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {item.menu_id !== 0 && (
                        <>
                          <button onClick={() => handleQuantityChange(item.menu_id, -1)} style={{ width: '24px', height: '24px', cursor: 'pointer' }}>-</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => handleQuantityChange(item.menu_id, 1)} style={{ width: '24px', height: '24px', cursor: 'pointer' }}>+</button>
                        </>
                      )}
                      {item.menu_id === 0 && <span>{item.quantity}개</span>}
                      <span style={{ width: '70px', textAlign: 'right' }}>{(item.price * item.quantity).toLocaleString()}원</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
              <span>총 결제금액</span>
              <span style={{ color: '#007bff' }}>{calculatedTotal.toLocaleString()}원</span>
            </div>

            <button
              onClick={handleSubmitOrder}
              style={{ width: '100%', padding: '15px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              주문 완료 (결제하기)
            </button>
          </div>
        </div>
      )}

      {/* [2] 일매출 정산 탭 */}
      {currentTab === 'sales' && (
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6', height: 'fit-content' }}>
            <h4 style={{ marginTop: 0, marginBottom: '15px' }}>일자 목록</h4>
            {salesDates.length === 0 ? (
              <p style={{ color: '#adb5bd', fontSize: '14px' }}>매출 내역이 없습니다.</p>
            ) : (
              salesDates.map(date => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    width: '100%', padding: '12px', marginBottom: '8px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
                    backgroundColor: selectedDate === date ? '#007bff' : '#f8f9fa',
                    color: selectedDate === date ? '#fff' : '#495057',
                    border: '1px solid #ced4da', borderRadius: '6px'
                  }}
                >
                  {date}
                </button>
              ))
            )}
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
            <h3 style={{ marginTop: 0, textAlign: 'center', marginBottom: '20px' }}>{selectedDate} 매출 상세 정보</h3>

            {/* 상단 필터 영역 (가게, 주문/배달, 결제수단 쪼개기 완료) */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e9ecef', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 'bold', marginRight: '8px' }}>가게 구분:</span>
                {['전체', ...storeTags.map(s => s.name)].map(stName => (
                  <button
                    key={stName}
                    onClick={() => setSelectedStoreFilter(stName)}
                    style={{
                      padding: '5px 10px', marginRight: '4px', fontSize: '12px', cursor: 'pointer',
                      backgroundColor: selectedStoreFilter === stName ? '#495057' : '#fff',
                      color: selectedStoreFilter === stName ? '#fff' : '#495057',
                      border: '1px solid #ced4da', borderRadius: '4px'
                    }}
                  >
                    {stName}
                  </button>
                ))}
              </div>

              <div>
                <span style={{ fontSize: '13px', fontWeight: 'bold', marginRight: '8px' }}>주문/배달:</span>
                {['전체', ...orderTypes.map(ot => ot.name)].map(otName => (
                  <button
                    key={otName}
                    onClick={() => setSelectedOrderTypeFilter(otName)}
                    style={{
                      padding: '5px 10px', marginRight: '4px', fontSize: '12px', cursor: 'pointer',
                      backgroundColor: selectedOrderTypeFilter === otName ? '#007bff' : '#fff',
                      color: selectedOrderTypeFilter === otName ? '#fff' : '#495057',
                      border: '1px solid #ced4da', borderRadius: '4px'
                    }}
                  >
                    {otName}
                  </button>
                ))}
              </div>

              <div>
                <span style={{ fontSize: '13px', fontWeight: 'bold', marginRight: '8px' }}>결제 수단:</span>
                {['전체', '카드', '현금'].map(pName => (
                  <button
                    key={pName}
                    onClick={() => setSelectedPaymentFilter(pName)}
                    style={{
                      padding: '5px 10px', marginRight: '4px', fontSize: '12px', cursor: 'pointer',
                      backgroundColor: selectedPaymentFilter === pName ? '#28a745' : '#fff',
                      color: selectedPaymentFilter === pName ? '#fff' : '#495057',
                      border: '1px solid #ced4da', borderRadius: '4px'
                    }}
                  >
                    {pName}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div style={{ padding: '20px', backgroundColor: '#e7f5ff', borderRadius: '8px', border: '1px solid #bae8ff', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: '#1864ab', marginBottom: '5px' }}>총 주문 건수</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1c7ed6' }}>{filteredDailyOrders.length} 건</div>
              </div>
              <div style={{ padding: '20px', backgroundColor: '#ebfbee', borderRadius: '8px', border: '1px solid #d3f9d8', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: '#2b8a3e', marginBottom: '5px' }}>총 매출 금액</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2b8a3e' }}>{totalFilteredSalesAmount.toLocaleString()} 원</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>주문일시</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>구분 (결제)</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>주문 상품 상세</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>총 금액</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredDailyOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#adb5bd' }}>조건에 해당하는 주문 내역이 없습니다.</td>
                  </tr>
                ) : (
                  filteredDailyOrders.map(order => {
                    const formattedDate = order.created_at ? order.created_at.replace('T', ' ').substring(0, 16) : '';
                    const orderTypeName = order.order_types ? order.order_types.name : '기타';
                    const payType = order.payment_type || '카드';

                    const itemsDesc = order.order_items?.map(oi => {
                      const menuName = oi.menus ? oi.menus.name : '할인/기타';
                      return `${menuName}(${oi.quantity}개)`;
                    }).join(', ') || '';

                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '12px 10px', color: '#495057' }}>{formattedDate}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ padding: '4px 8px', backgroundColor: '#e9ecef', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            {orderTypeName} ({payType})
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>{itemsDesc}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold' }}>{order.total_amount.toLocaleString()}원</td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setEditDiscountInput('');
                            }}
                            style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginRight: '5px' }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            style={{ padding: '5px 10px', backgroundColor: '#fa5252', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* [3] 메뉴 관리 탭 */}
      {currentTab === 'menu' && (
        <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <h3 style={{ marginTop: 0 }}>메뉴 관리</h3>
          <form onSubmit={handleAddMenu} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <select
              value={newMenuStoreTagId}
              onChange={(e) => setNewMenuStoreTagId(e.target.value)}
              style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
            >
              <option value="">가게 선택</option>
              {storeTags.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="메뉴 이름"
              value={newMenuName}
              onChange={(e) => setNewMenuName(e.target.value)}
              style={{ flex: 1, padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
            />
            <input
              type="number"
              placeholder="가격"
              value={newMenuPrice}
              onChange={(e) => setNewMenuPrice(e.target.value)}
              style={{ width: '100px', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
            />
            <button type="submit" style={{ padding: '8px 15px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>추가</button>
          </form>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>가게 구분</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>메뉴명</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>가격</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {menus.map(menu => {
                const tagObj = storeTags.find(t => t.id === menu.store_tag_id);
                return (
                  <tr key={menu.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '10px' }}>{tagObj ? tagObj.name : '-'}</td>
                    <td style={{ padding: '10px' }}>{menu.name}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{menu.price.toLocaleString()}원</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button onClick={() => handleDeleteMenu(menu.id)} style={{ padding: '4px 8px', backgroundColor: '#fa5252', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* [4] 가게/배달 관리 탭 (순서 변경 저장 기능 추가) */}
      {currentTab === 'store' && (
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
            <h3 style={{ marginTop: 0 }}>가게 구분 관리</h3>
            <form onSubmit={handleAddStoreTag} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="새 가게 이름 (예: 죽풍경)"
                value={newStoreTagName}
                onChange={(e) => setNewStoreTagName(e.target.value)}
                style={{ flex: 1, padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              />
              <button type="submit" style={{ padding: '8px 15px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>추가</button>
            </form>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
              {storeTags.map((tag, idx) => (
                <li key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <span style={{ fontWeight: 'bold' }}>{tag.name}</span>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <button onClick={() => handleMoveOrderIndex(storeTags, setStoreTags, idx, 'up', 'store')} style={{ padding: '3px 8px', cursor: 'pointer' }}>▲</button>
                    <button onClick={() => handleMoveOrderIndex(storeTags, setStoreTags, idx, 'down', 'store')} style={{ padding: '3px 8px', cursor: 'pointer' }}>▼</button>
                    <button onClick={() => handleDeleteStoreTag(tag.id)} style={{ padding: '4px 8px', backgroundColor: '#fa5252', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>삭제</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
            <h3 style={{ marginTop: 0 }}>주문/배달 구분 관리</h3>
            <form onSubmit={handleAddOrderType} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="새 주문 구분 (예: 배달의민족)"
                value={newOrderTypeName}
                onChange={(e) => setNewOrderTypeName(e.target.value)}
                style={{ flex: 1, padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              />
              <button type="submit" style={{ padding: '8px 15px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>추가</button>
            </form>
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
              {orderTypes.map((ot, idx) => (
                <li key={ot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <span style={{ fontWeight: 'bold' }}>{ot.name}</span>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <button onClick={() => handleMoveOrderIndex(orderTypes, setOrderTypes, idx, 'up', 'orderType')} style={{ padding: '3px 8px', cursor: 'pointer' }}>▲</button>
                    <button onClick={() => handleMoveOrderIndex(orderTypes, setOrderTypes, idx, 'down', 'orderType')} style={{ padding: '3px 8px', cursor: 'pointer' }}>▼</button>
                    <button onClick={() => handleDeleteOrderType(ot.id)} style={{ padding: '4px 8px', backgroundColor: '#fa5252', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>삭제</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 주문 수정 모달 (할인 추가, 수량 변경 등 주문 입력과 동일한 기능 완벽 탑재) */}
      {editingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '8px', width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>주문 수정</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '5px' }}>결제 수단</label>
              <select
                value={editingOrder.payment_type}
                onChange={(e) => setEditingOrder({ ...editingOrder, payment_type: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              >
                <option value="카드">카드</option>
                <option value="현금">현금</option>
              </select>
            </div>

            {/* 수정 모달 내 금액 할인 추가 기능 */}
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
              <label style={{ fontSize: '13px', color: '#495057', display: 'block', marginBottom: '5px' }}>할인/기타 항목 추가</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input 
                  type="number" 
                  value={editDiscountInput} 
                  onChange={(e) => setEditDiscountInput(e.target.value)} 
                  placeholder="할인 금액 입력"
                  style={{ flex: 1, padding: '6px', fontSize: '14px', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
                <button 
                  onClick={() => {
                    if (!editDiscountInput || isNaN(editDiscountInput) || Number(editDiscountInput) <= 0) {
                      alert('올바른 할인 금액을 입력해주세요.');
                      return;
                    }
                    const dAmt = Number(editDiscountInput);
                    const updatedItems = [...editingOrder.order_items, { menu_id: 0, name: '할인/기타', price: -dAmt, quantity: 1 }];
                    setEditingOrder({ ...editingOrder, order_items: updatedItems });
                    setEditDiscountInput('');
                  }}
                  style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                >
                  할인 추가
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '5px' }}>주문 상품 목록</label>
              {editingOrder.order_items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', backgroundColor: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
                  <span>{item.menus ? item.menus.name : item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.menu_id !== 0 && (
                      <>
                        <button 
                          onClick={() => {
                            const newItems = [...editingOrder.order_items];
                            if (newItems[idx].quantity > 1) {
                              newItems[idx].quantity -= 1;
                              setEditingOrder({ ...editingOrder, order_items: newItems });
                            }
                          }}
                          style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                        >-</button>
                        <span>{item.quantity}</span>
                        <button 
                          onClick={() => {
                            const newItems = [...editingOrder.order_items];
                            newItems[idx].quantity += 1;
                            setEditingOrder({ ...editingOrder, order_items: newItems });
                          }}
                          style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                        >+</button>
                      </>
                    )}
                    {item.menu_id === 0 && <span>{item.quantity}개</span>}
                    <span style={{ width: '70px', textAlign: 'right' }}>{(item.price * item.quantity).toLocaleString()}원</span>
                    <button 
                      onClick={() => {
                        const newItems = editingOrder.order_items.filter((_, i) => i !== idx);
                        setEditingOrder({ ...editingOrder, order_items: newItems });
                      }}
                      style={{ padding: '2px 6px', backgroundColor: '#fa5252', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', marginBottom: '20px' }}>
              <span>수정된 총 금액</span>
              <span style={{ color: '#007bff' }}>
                {editingOrder.order_items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toLocaleString()}원
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleUpdateOrderSubmit}
                style={{ flex: 1, padding: '10px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                저장하기
              </button>
              <button
                onClick={() => setEditingOrder(null)}
                style={{ flex: 1, padding: '10px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}