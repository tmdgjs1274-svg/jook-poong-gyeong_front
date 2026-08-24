import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  ShoppingCart, Plus, Trash2, Edit, Check, X, ArrowUp, ArrowDown, 
  Settings, DollarSign, Calendar, Clock, CreditCard, RefreshCw, Menu as MenuIcon, Filter
} from 'lucide-react';

// API 기본 주소 설정 (환경에 맞게 변경 가능)
const API_BASE_URL = 'http://localhost:3000/api';

export default function App() {
  // 탭 상태: 'pos' (포스주문), 'sales' (일매출정산), 'menus' (메뉴관리), 'settings' (가게/배달관리)
  const [activeTab, setActiveTab] = useState('pos');

  // 데이터 상태
  const [storeTags, setStoreTags] = useState([]);
  const [selectedStoreTag, setSelectedStoreTag] = useState('전체');
  const [categories, setCategories] = useState([]);
  const [menus, setMenus] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);
  
  // 포스 주문 상태
  const [cart, setCart] = useState([]);
  const [selectedOrderType, setSelectedOrderType] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  
  // 옵션 선택 모달 상태
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [currentMenuForOption, setCurrentMenuForOption] = useState(null);
  const [selectedOptionsState, setSelectedOptionsState] = useState({}); // { groupName: itemName }

  // 메뉴 관리 모달 및 폼 상태
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [menuForm, setMenuForm] = useState({ 
    name: '', 
    price: '', 
    category_id: '', 
    store_tag: '', 
    options: [] // [{ groupName: '사이즈', items: [{ name: '곱빼기', extraPrice: 1000 }] }]
  });

  // 일매출 정산 상태
  const [salesDates, setSalesDates] = useState([]);
  const [selectedSalesDate, setSelectedSalesDate] = useState('');
  const [dailySales, setDailySales] = useState([]);

  // 설정 관리 상태
  const [newStoreTagName, setNewStoreTagName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newOrderTypeName, setNewOrderTypeName] = useState('');

  // 초기 데이터 로드
  useEffect(() => {
    fetchInitialData();
  }, [selectedStoreTag]);

  const fetchInitialData = async () => {
    try {
      const [tagsRes, catRes, menusRes, typesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/store-tags`),
        axios.get(`${API_BASE_URL}/categories?store_tag=${selectedStoreTag}`),
        axios.get(`${API_BASE_URL}/menus?store_tag=${selectedStoreTag}`),
        axios.get(`${API_BASE_URL}/order-types`)
      ]);
      setStoreTags(tagsRes.data || []);
      setCategories(catRes.data || []);
      setMenus(menusRes.data || []);
      setOrderTypes(typesRes.data || []);
      if (typesRes.data.length > 0 && !selectedOrderType) {
        setSelectedOrderType(typesRes.data[0].id);
      }
    } catch (err) {
      console.error('초기 데이터 로딩 실패:', err);
    }
  };

  // 매출 날짜 목록 로드
  useEffect(() => {
    if (activeTab === 'sales') {
      axios.get(`${API_BASE_URL}/sales/dates`)
        .then(res => {
          setSalesDates(res.data);
          if (res.data.length > 0 && !selectedSalesDate) {
            setSelectedSalesDate(res.data[0]);
          }
        })
        .catch(err => console.error('매출 날짜 조회 실패:', err));
    }
  }, [activeTab]);

  // 선택된 날짜의 매출 조회
  useEffect(() => {
    if (activeTab === 'sales' && selectedSalesDate) {
      axios.get(`${API_BASE_URL}/sales/daily?date=${selectedSalesDate}`)
        .then(res => setDailySales(res.data))
        .catch(err => console.error('일일 매출 조회 실패:', err));
    }
  }, [selectedSalesDate, activeTab]);

  // ==========================================
  // [주문 및 옵션 처리 로직]
  // ==========================================
  const handleMenuClick = (menu) => {
    // 옵션이 설정되어 있다면 옵션 선택 모달 오픈
    if (menu.options && menu.options.length > 0) {
      setCurrentMenuForOption(menu);
      // 기본값 초기화 (각 그룹의 첫 번째 아이템 선택)
      const initialOptions = {};
      menu.options.forEach(optGroup => {
        if (optGroup.items && optGroup.items.length > 0) {
          initialOptions[optGroup.groupName] = optGroup.items[0];
        }
      });
      setSelectedOptionsState(initialOptions);
      setOptionModalOpen(true);
    } else {
      // 옵션이 없으면 바로 장바구니 추가
      addToCart(menu, [], 0);
    }
  };

  const addToCart = (menu, selectedOpts, extraPriceSum) => {
    const finalPrice = Number(menu.price) + Number(extraPriceSum);
    
    // 동일한 메뉴이면서 선택된 옵션까지 완전히 일치하는 경우 수량 증가
    const cartItemKey = `${menu.id}_${JSON.stringify(selectedOpts)}`;
    
    setCart(prev => {
      const existingIndex = prev.findIndex(item => `${item.menu_id}_${JSON.stringify(item.selected_options)}` === cartItemKey);
      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += 1;
        return newCart;
      } else {
        return [...prev, {
          menu_id: menu.id,
          name: menu.name,
          base_price: menu.price,
          price: finalPrice,
          quantity: 1,
          selected_options: selectedOpts // [{ groupName, name, extraPrice }]
        }];
      }
    });
  };

  const handleCompleteOptionSelect = () => {
    if (!currentMenuForOption) return;
    
    const selectedOptsArray = [];
    let extraSum = 0;

    Object.keys(selectedOptionsState).forEach(groupName => {
      const item = selectedOptionsState[groupName];
      if (item) {
        selectedOptsArray.push({
          groupName,
          name: item.name,
          extraPrice: Number(item.extraPrice || 0)
        });
        extraSum += Number(item.extraPrice || 0);
      }
    });

    addToCart(currentMenuForOption, selectedOptsArray, extraSum);
    setOptionModalOpen(false);
    setCurrentMenuForOption(null);
  };

  const updateCartQuantity = (index, delta) => {
    setCart(prev => {
      const newCart = [...prev];
      newCart[index].quantity += delta;
      if (newCart[index].quantity <= 0) {
        return newCart.filter((_, i) => i !== index);
      }
      return newCart;
    });
  };

  const handleCheckout = async (paymentType) => {
    if (cart.length === 0) return alert('장바구니가 비어있습니다.');
    if (!selectedOrderType) return alert('배달/주문 구분을 선택해주세요.');

    const total_amount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const orderPayload = {
      order_type_id: selectedOrderType,
      payment_type: paymentType,
      total_amount,
      items: cart
    };

    try {
      await axios.post(`${API_BASE_URL}/orders`, orderPayload);
      alert('주문이 완료되었습니다!');
      setCart([]);
    } catch (err) {
      console.error('주문 전송 실패:', err);
      alert('주문 처리 중 오류가 발생했습니다.');
    }
  };

  // ==========================================
  // [메뉴 관리 (부가옵션 추가/수정) 로직]
  // ==========================================
  const handleOpenMenuModal = (menu = null) => {
    if (menu) {
      setEditingMenu(menu);
      setMenuForm({
        name: menu.name,
        price: menu.price,
        category_id: menu.category_id || '',
        store_tag: menu.store_tag || selectedStoreTag,
        options: menu.options ? JSON.parse(JSON.stringify(menu.options)) : []
      });
    } else {
      setEditingMenu(null);
      setMenuForm({
        name: '',
        price: '',
        category_id: categories.length > 0 ? categories[0].id : '',
        store_tag: selectedStoreTag === '전체' ? (storeTags[0]?.name || '') : selectedStoreTag,
        options: []
      });
    }
    setMenuModalOpen(true);
  };

  const handleSaveMenu = async (e) => {
    e.preventDefault();
    try {
      if (editingMenu) {
        await axios.put(`${API_BASE_URL}/menus/${editingMenu.id}`, menuForm);
      } else {
        await axios.post(`${API_BASE_URL}/menus`, menuForm);
      }
      setMenuModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error('메뉴 저장 실패:', err);
      alert('메뉴 저장 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteMenu = async (id) => {
    if (!window.confirm('정말 이 메뉴를 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/menus/${id}`);
      fetchInitialData();
    } catch (err) {
      console.error('메뉴 삭제 실패:', err);
    }
  };

  // 메뉴 옵션 그룹 동적 추가/삭제 함수들
  const addOptionGroup = () => {
    setMenuForm(prev => ({
      ...prev,
      options: [...prev.options, { groupName: '', items: [{ name: '', extraPrice: 0 }] }]
    }));
  };

  const removeOptionGroup = (groupIndex) => {
    setMenuForm(prev => ({
      ...prev,
      options: prev.options.filter((_, idx) => idx !== groupIndex)
    }));
  };

  const addOptionItem = (groupIndex) => {
    setMenuForm(prev => {
      const newOptions = [...prev.options];
      newOptions[groupIndex].items.push({ name: '', extraPrice: 0 });
      return { ...prev, options: newOptions };
    });
  };

  const removeOptionItem = (groupIndex, itemIndex) => {
    setMenuForm(prev => {
      const newOptions = [...prev.options];
      newOptions[groupIndex].items = newOptions[groupIndex].items.filter((_, idx) => idx !== itemIndex);
      return { ...prev, options: newOptions };
    });
  };

  // ==========================================
  // [설정 및 기타 관리 로직]
  // ==========================================
  const handleAddStoreTag = async (e) => {
    e.preventDefault();
    if (!newStoreTagName.trim()) return;
    try {
      await axios.post(`${API_BASE_URL}/store-tags`, { name: newStoreTagName });
      setNewStoreTagName('');
      fetchInitialData();
    } catch (err) { console.error(err); }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await axios.post(`${API_BASE_URL}/categories`, { name: newCategoryName, store_tag: selectedStoreTag });
      setNewCategoryName('');
      fetchInitialData();
    } catch (err) { console.error(err); }
  };

  const handleAddOrderType = async (e) => {
    e.preventDefault();
    if (!newOrderTypeName.trim()) return;
    try {
      await axios.post(`${API_BASE_URL}/order-types`, { name: newOrderTypeName });
      setNewOrderTypeName('');
      fetchInitialData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteItem = async (url, id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/${url}/${id}`);
      fetchInitialData();
    } catch (err) { console.error(err); }
  };

  // 렌더링 필터링된 메뉴
  const filteredMenus = menus.filter(menu => {
    if (selectedCategory === '전체') return true;
    return menu.category === selectedCategory;
  });

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      {/* 상단 네비게이션 및 가게 필터 바 */}
      <header className="bg-white border-b px-4 py-3 flex flex-wrap justify-between items-center gap-4 shadow-sm">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MenuIcon className="w-6 h-6 text-blue-600" /> POS 시스템
          </h1>
          {/* 상단 메뉴 탭 */}
          <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('pos')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'pos' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              포스 주문
            </button>
            <button 
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'sales' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              일매출 정산
            </button>
            <button 
              onClick={() => setActiveTab('menus')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'menus' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              메뉴 관리
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              가게/배달 설정
            </button>
          </nav>
        </div>

        {/* 가게 구분 필터 (우측 배치) */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 flex items-center gap-1">
            <Filter className="w-4 h-4" /> 가게 구분:
          </span>
          <select 
            value={selectedStoreTag} 
            onChange={(e) => setSelectedStoreTag(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-white font-medium text-blue-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="전체">전체 매장</option>
            {storeTags.map(tag => (
              <option key={tag.id} value={tag.name}>{tag.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 overflow-hidden">
        {/* ================= [1] 포스 주문 탭 ================= */}
        {activeTab === 'pos' && (
          <div className="flex h-full flex-col lg:flex-row">
            {/* 좌측: 메뉴판 영역 */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              {/* 카테고리 필터 버튼 */}
              <div className="flex gap-2 overflow-x-auto pb-3 mb-2 shrink-0">
                <button
                  onClick={() => setSelectedCategory('전체')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedCategory === '전체' ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
                >
                  전체보기
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${selectedCategory === cat.name ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-200'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* 메뉴 카드 그리드 (모바일 2열 대응) */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pr-1">
                {filteredMenus.map(menu => (
                  <button
                    key={menu.id}
                    onClick={() => handleMenuClick(menu)}
                    className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-500 hover:shadow-md transition flex flex-col justify-between text-left h-32 relative group"
                  >
                    <div>
                      <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                        {menu.category}
                      </span>
                      <h3 className="font-bold text-gray-800 mt-1.5 text-base line-clamp-1">{menu.name}</h3>
                      {menu.options && menu.options.length > 0 && (
                        <span className="text-[11px] text-orange-500 font-medium block mt-0.5">부가옵션 있음</span>
                      )}
                    </div>
                    <div className="text-right w-full">
                      <span className="font-extrabold text-gray-900 text-lg">{Number(menu.price).toLocaleString()}원</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 우측/하단: 장바구니 및 결제 영역 */}
            <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l flex flex-col h-1/2 lg:h-full shadow-lg">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" /> 장바구니
                </h2>
                <button 
                  onClick={() => setCart([])} 
                  className="text-xs text-red-500 hover:underline font-medium"
                >
                  전체 비우기
                </button>
              </div>

              {/* 배달/주문 구분 선택 */}
              <div className="p-3 border-b bg-gray-100 flex gap-2 overflow-x-auto">
                {orderTypes.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => setSelectedOrderType(ot.id)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${selectedOrderType === ot.id ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 border'}`}
                  >
                    {ot.name}
                  </button>
                ))}
              </div>

              {/* 장바구니 아이템 리스트 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                    <ShoppingCart className="w-12 h-12 mb-2 stroke-1" />
                    장바구니가 비어있습니다.
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 border rounded-lg p-3 flex flex-col gap-1 shadow-sm">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-gray-800 text-sm">{item.name}</span>
                        <button 
                          onClick={() => updateCartQuantity(idx, -item.quantity)} 
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* 선택된 부가옵션 표시 */}
                      {item.selected_options && item.selected_options.length > 0 && (
                        <div className="text-xs text-gray-500 bg-gray-200/60 p-1.5 rounded space-y-0.5">
                          {item.selected_options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex justify-between">
                              <span>- {opt.groupName}: <strong className="text-gray-700">{opt.name}</strong></span>
                              {opt.extraPrice > 0 && <span className="text-blue-600">+{opt.extraPrice.toLocaleString()}원</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-1">
                        <div className="flex items-center gap-2 bg-white border rounded px-2 py-0.5">
                          <button onClick={() => updateCartQuantity(idx, -1)} className="text-gray-600 font-bold px-1">-</button>
                          <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(idx, 1)} className="text-gray-600 font-bold px-1">+</button>
                        </div>
                        <span className="font-bold text-gray-900 text-sm">
                          {(item.price * item.quantity).toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 결제 총액 및 결제 버튼 */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-600 font-medium">총 결제금액</span>
                  <span className="text-2xl font-extrabold text-blue-600">
                    {cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}원
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleCheckout('카드')}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-sm shadow transition flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-4 h-4" /> 카드 결제
                  </button>
                  <button 
                    onClick={() => handleCheckout('현금')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-sm shadow transition flex items-center justify-center gap-1.5"
                  >
                    <DollarSign className="w-4 h-4" /> 현금 결제
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= [2] 일매출 정산 탭 ================= */}
        {activeTab === 'sales' && (
          <div className="h-full flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" /> 일매출 정산 내역
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">정산 일자 선택:</span>
                <select 
                  value={selectedSalesDate}
                  onChange={(e) => setSelectedSalesDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm font-medium text-blue-600"
                >
                  {salesDates.map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 매출 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-5 rounded-xl border shadow-sm">
                <span className="text-sm text-gray-500 font-medium">총 매출액</span>
                <p className="text-2xl font-extrabold text-blue-600 mt-1">
                  {dailySales.reduce((sum, o) => sum + Number(o.total_amount), 0).toLocaleString()}원
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl border shadow-sm">
                <span className="text-sm text-gray-500 font-medium">총 주문 건수</span>
                <p className="text-2xl font-extrabold text-gray-800 mt-1">
                  {dailySales.length}건
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl border shadow-sm">
                <span className="text-sm text-gray-500 font-medium">결제 수단별</span>
                <div className="flex gap-4 mt-2 text-sm font-bold text-gray-700">
                  <span>카드: {dailySales.filter(o => o.payment_type === '카드').length}건</span>
                  <span>현금: {dailySales.filter(o => o.payment_type === '현금').length}건</span>
                </div>
              </div>
            </div>

            {/* 주문 상세 내역 테이블 */}
            <div className="bg-white rounded-xl border shadow-sm flex-1 overflow-hidden flex flex-col">
              <div className="p-4 border-b bg-gray-50 font-bold text-gray-700">주문 상세 리스트</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {dailySales.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">해당 일자에 완료된 주문 내역이 없습니다.</div>
                ) : (
                  dailySales.map(order => (
                    <div key={order.id} className="border rounded-lg p-4 bg-gray-50 flex flex-col md:flex-row justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">
                            주문번호 #{order.id}
                          </span>
                          <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                            {order.order_types?.name || '일반'}
                          </span>
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            {order.payment_type}결제
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(order.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        {/* 주문 아이템 및 옵션 내역 */}
                        <div className="pl-2 pt-1 space-y-1">
                          {order.order_items?.map((item, i) => {
                            let parsedOpts = [];
                            try {
                              if (item.selected_options) parsedOpts = JSON.parse(item.selected_options);
                            } catch (e) {}

                            return (
                              <div key={i} className="text-sm">
                                <span className="font-bold text-gray-800">{item.menus?.name || '삭제된 메뉴'}</span>
                                <span className="text-gray-600 ml-2">({item.quantity}개) - {(item.price * item.quantity).toLocaleString()}원</span>
                                {parsedOpts.length > 0 && (
                                  <div className="text-xs text-gray-500 pl-3">
                                    {parsedOpts.map((o, oi) => (
                                      <span key={oi} className="mr-2">[{o.groupName}: {o.name} {o.extraPrice > 0 ? `(+${o.extraPrice}원)` : ''}]</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col justify-between items-end shrink-0">
                        <span className="text-lg font-extrabold text-blue-600">{Number(order.total_amount).toLocaleString()}원</span>
                        <button 
                          onClick={async () => {
                            if (!window.confirm(`주문 #${order.id} 내역을 삭제하시겠습니까?`)) return;
                            await axios.delete(`${API_BASE_URL}/orders/${order.id}`);
                            setSelectedSalesDate(prev => prev); // 리프레시 트리거
                          }}
                          className="text-xs text-red-500 hover:underline mt-2 font-medium"
                        >
                          주문 취소/삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= [3] 메뉴 관리 탭 ================= */}
        {activeTab === 'menus' && (
          <div className="h-full flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">메뉴 및 부가옵션 관리</h2>
              <button 
                onClick={() => handleOpenMenuModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> 새 메뉴 등록
              </button>
            </div>

            {/* 메뉴 리스트 테이블 */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b text-xs font-bold text-gray-600 sticky top-0">
                    <tr>
                      <th className="p-4">가게 구분</th>
                      <th className="p-4">카테고리</th>
                      <th className="p-4">메뉴명</th>
                      <th className="p-4">기본 가격</th>
                      <th className="p-4">부가옵션 설정 현황</th>
                      <th className="p-4 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {menus.map(menu => (
                      <tr key={menu.id} className="hover:bg-gray-50">
                        <td className="p-4 font-semibold text-blue-600">{menu.store_tag || '-'}</td>
                        <td className="p-4 text-gray-600">{menu.category}</td>
                        <td className="p-4 font-bold text-gray-800">{menu.name}</td>
                        <td className="p-4 font-extrabold text-gray-900">{Number(menu.price).toLocaleString()}원</td>
                        <td className="p-4 text-xs text-gray-500">
                          {menu.options && menu.options.length > 0 ? (
                            menu.options.map((og, idx) => (
                              <div key={idx} className="mb-0.5">
                                <span className="font-bold text-gray-700">{og.groupName}:</span> {og.items.map(i => `${i.name}(+${i.extraPrice}원)`).join(', ')}
                              </div>
                            ))
                          ) : (
                            <span className="text-gray-400">옵션 없음</span>
                          )}
                        </td>
                        <td className="p-4 text-center space-x-2">
                          <button onClick={() => handleOpenMenuModal(menu)} className="text-blue-600 hover:underline font-medium">수정</button>
                          <button onClick={() => handleDeleteMenu(menu.id)} className="text-red-500 hover:underline font-medium">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= [4] 설정 관리 탭 ================= */}
        {activeTab === 'settings' && (
          <div className="h-full flex flex-col p-6 overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-6">가게 및 배달 구분 설정</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 가게 구분 설정 */}
              <div className="bg-white p-5 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">가게 구분 관리</h3>
                <form onSubmit={handleAddStoreTag} className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    placeholder="새 가게 이름 (예: 죽풍경)" 
                    value={newStoreTagName}
                    onChange={(e) => setNewStoreTagName(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow">추가</button>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {storeTags.map(tag => (
                    <div key={tag.id} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg border">
                      <span className="text-sm font-semibold text-gray-700">{tag.name}</span>
                      <button onClick={() => handleDeleteItem('store-tags', tag.id)} className="text-red-500 text-xs font-bold hover:underline">삭제</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 카테고리 설정 */}
              <div className="bg-white p-5 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">카테고리 관리 ({selectedStoreTag})</h3>
                <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    placeholder="새 카테고리 이름 (예: 면류)" 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow">추가</button>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg border">
                      <span className="text-sm font-semibold text-gray-700">{cat.name}</span>
                      <button onClick={() => handleDeleteItem('categories', cat.id)} className="text-red-500 text-xs font-bold hover:underline">삭제</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 배달/주문 구분 설정 */}
              <div className="bg-white p-5 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4">배달/주문 구분 관리</h3>
                <form onSubmit={handleAddOrderType} className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    placeholder="새 주문 구분 (예: 배달의민족)" 
                    value={newOrderTypeName}
                    onChange={(e) => setNewOrderTypeName(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow">추가</button>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {orderTypes.map(ot => (
                    <div key={ot.id} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg border">
                      <span className="text-sm font-semibold text-gray-700">{ot.name}</span>
                      <button onClick={() => handleDeleteItem('order-types', ot.id)} className="text-red-500 text-xs font-bold hover:underline">삭제</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* [모달 1] 주문 시 부가옵션 선택 모달         */}
      {/* ========================================== */}
      {optionModalOpen && currentMenuForOption && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">옵션 선택: {currentMenuForOption.name}</h3>
              <button onClick={() => setOptionModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="text-sm text-gray-500 font-medium">기본 가격: {Number(currentMenuForOption.price).toLocaleString()}원</div>
              
              {currentMenuForOption.options.map((optGroup, gIdx) => (
                <div key={gIdx} className="space-y-2 border-b pb-4">
                  <label className="font-bold text-gray-800 text-sm block">📌 {optGroup.groupName}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {optGroup.items.map((optItem, iIdx) => {
                      const isSelected = selectedOptionsState[optGroup.groupName]?.name === optItem.name;
                      return (
                        <button
                          key={iIdx}
                          type="button"
                          onClick={() => {
                            setSelectedOptionsState(prev => ({ ...prev, [optGroup.groupName]: optItem }));
                          }}
                          className={`p-3 rounded-lg border text-sm font-semibold flex justify-between items-center transition ${isSelected ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}`}
                        >
                          <span>{optItem.name}</span>
                          <span className="text-xs font-bold text-gray-500">
                            {optItem.extraPrice > 0 ? `+${Number(optItem.extraPrice).toLocaleString()}원` : '기본'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-2">
              <button 
                onClick={() => setOptionModalOpen(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-bold text-sm transition"
              >
                취소
              </button>
              <button 
                onClick={handleCompleteOptionSelect}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm shadow transition"
              >
                장바구니 담기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* [모달 2] 메뉴 등록/수정 (부가옵션 설정 포함)   */}
      {/* ========================================== */}
      {menuModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">{editingMenu ? '메뉴 수정' : '새 메뉴 등록'}</h3>
              <button onClick={() => setMenuModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveMenu} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">메뉴명</label>
                  <input 
                    type="text" 
                    required
                    placeholder="예: 옛날칼국수"
                    value={menuForm.name}
                    onChange={(e) => setMenuForm({...menuForm, name: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">기본 가격</label>
                  <input 
                    type="number" 
                    required
                    placeholder="예: 8000"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({...menuForm, price: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">가게 구분</label>
                  <select 
                    value={menuForm.store_tag}
                    onChange={(e) => setMenuForm({...menuForm, store_tag: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {storeTags.map(tag => (
                      <option key={tag.id} value={tag.name}>{tag.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">카테고리</label>
                  <select 
                    value={menuForm.category_id}
                    onChange={(e) => setMenuForm({...menuForm, category_id: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">카테고리 선택</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 부가옵션 설정 섹션 */}
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-gray-800 text-sm">하위 부가옵션 설정 (예: 사이즈, 종류)</h4>
                  <button 
                    type="button" 
                    onClick={addOptionGroup}
                    className="bg-gray-100 hover:bg-gray-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                  >
                    + 옵션 그룹 추가
                  </button>
                </div>

                <div className="space-y-4">
                  {menuForm.options.map((group, gIdx) => (
                    <div key={gIdx} className="bg-gray-50 border p-4 rounded-xl space-y-3">
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          placeholder="그룹명 (예: 사이즈 선택)"
                          value={group.groupName}
                          onChange={(e) => {
                            const newOpts = [...menuForm.options];
                            newOpts[gIdx].groupName = e.target.value;
                            setMenuForm({...menuForm, options: newOpts});
                          }}
                          className="flex-1 border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
                        />
                        <button 
                          type="button" 
                          onClick={() => removeOptionGroup(gIdx)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg text-xs font-bold"
                        >
                          그룹 삭제
                        </button>
                      </div>

                      {/* 하위 옵션 항목 리스트 */}
                      <div className="pl-4 space-y-2 border-l-2 border-blue-300">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500">세부 옵션 항목 및 추가 금액</span>
                          <button 
                            type="button" 
                            onClick={() => addOptionItem(gIdx)}
                            className="text-xs text-blue-600 font-bold hover:underline"
                          >
                            + 항목 추가
                          </button>
                        </div>
                        {group.items.map((item, iIdx) => (
                          <div key={iIdx} className="flex gap-2 items-center">
                            <input 
                              type="text" 
                              placeholder="항목명 (예: 곱빼기)"
                              value={item.name}
                              onChange={(e) => {
                                const newOpts = [...menuForm.options];
                                newOpts[gIdx].items[iIdx].name = e.target.value;
                                setMenuForm({...menuForm, options: newOpts});
                              }}
                              className="flex-1 border rounded-lg px-3 py-1 text-sm bg-white focus:outline-none"
                            />
                            <input 
                              type="number" 
                              placeholder="추가금액 (예: 1000)"
                              value={item.extraPrice}
                              onChange={(e) => {
                                const newOpts = [...menuForm.options];
                                newOpts[gIdx].items[iIdx].extraPrice = e.target.value;
                                setMenuForm({...menuForm, options: newOpts});
                              }}
                              className="w-32 border rounded-lg px-3 py-1 text-sm bg-white focus:outline-none"
                            />
                            <span className="text-xs text-gray-500">원</span>
                            <button 
                              type="button" 
                              onClick={() => removeOptionItem(gIdx, iIdx)}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setMenuModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-bold"
                >
                  취소
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
