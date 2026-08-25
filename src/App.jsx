import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function App() {
  // new Date().toISOString()은 UTC 기준이라 밤 12시~오전 9시(한국 시간) 사이에는 날짜가 하루 전으로
  // 밀리는 문제가 있었다. 브라우저의 로컬 시간 기준으로 "YYYY-MM-DD"를 만들도록 수정.
  const getTodayStr = () => {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // 주문 저장/수정 시 사용할 timestamp 문자열을 만든다.
  // - dateStr: "YYYY-MM-DD" (사용자가 고른 저장 일자)
  // - refTimestamp: 시/분/초를 그대로 가져올 기준 시각(기존 주문의 원래 시각). 없으면 현재 시각을 사용한다.
  // 타임존 오프셋을 명시적으로 포함시켜서, DB 세션 타임존과 무관하게 항상 같은 실제 시각으로 저장되게 한다.
  // (기존에는 날짜만 "YYYY-MM-DD" 형태로 보냈는데, 이 경우 자정(00:00 UTC)으로 해석되어
  //  한국시간 기준 오전 9시로 고정되어 보이는 문제가 있었다.)
  const buildCreatedAtISO = (dateStr, refTimestamp) => {
    const ref = refTimestamp ? new Date(refTimestamp) : new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    const local = new Date(y, (m || 1) - 1, d, ref.getHours(), ref.getMinutes(), ref.getSeconds());
    const pad = n => String(n).padStart(2, '0');
    const offsetMin = -local.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const offH = pad(Math.floor(Math.abs(offsetMin) / 60));
    const offM = pad(Math.abs(offsetMin) % 60);
    return `${dateStr}T${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}${sign}${offH}:${offM}`;
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeTab, setActiveTab] = useState('pos');
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState(null);
  const [paymentType, setPaymentType] = useState('카드');
  const [orderDate, setOrderDate] = useState(getTodayStr());
  const [storeTags, setStoreTags] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [selectedPosStore, setSelectedPosStore] = useState('');
  const [selectedPosCategory, setSelectedPosCategory] = useState('');
  const [selectedMgmtStore, setSelectedMgmtStore] = useState('');
  const [selectedMgmtCategory, setSelectedMgmtCategory] = useState('전체');

  const [dateList, setDateList] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [dailyOrders, setDailyOrders] = useState([]);
  const [filterStore, setFilterStore] = useState('전체');
  const [filterOrderType, setFilterOrderType] = useState('전체');
  const [filterPaymentType, setFilterPaymentType] = useState('전체');

  // ===== 매출정산 - 일단위 / 월단위 / 연단위 =====
  const [salesViewMode, setSalesViewMode] = useState('daily'); // 'daily' | 'monthly' | 'yearly'
  const [selectedMonth, setSelectedMonth] = useState(''); // 'YYYY-MM' - 데이터가 존재하는 월 중에서만 선택
  const [selectedYear, setSelectedYear] = useState('');   // 'YYYY' - 데이터가 존재하는 연도 중에서만 선택
  const [rangeOrders, setRangeOrders] = useState([]);      // 월단위/연단위 조회 시 그 기간에 해당하는 주문 전체
  const [drillDownDate, setDrillDownDate] = useState(null); // 월단위 추이 차트에서 클릭한 특정 일자 (조회 전용)

  const [editingOrderModal, setEditingOrderModal] = useState(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMenu, setNewMenu] = useState({ name: '', price: '', store_tag: '', category_id: '', option_group_ids: [] });
  const [modalCategories, setModalCategories] = useState([]);
  const [modalOptionGroups, setModalOptionGroups] = useState([]); // 메뉴 등록/수정 모달에서 선택 가능한 가게의 옵션 그룹 목록
  const [editingMenuModal, setEditingMenuModal] = useState(null);
  const [newStoreInput, setNewStoreInput] = useState('');
  const [newOrderTypeInput, setNewOrderTypeInput] = useState('');

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountName, setDiscountName] = useState('금액 할인');
  const [discountAmount, setDiscountAmount] = useState('');

  const [isEditDiscountModalOpen, setIsEditDiscountModalOpen] = useState(false);
  const [editDiscountName, setEditDiscountName] = useState('금액 할인');
  const [editDiscountAmount, setEditDiscountAmount] = useState('');

  const [draggedOrderIdx, setDraggedOrderIdx] = useState(null);
  const [draggedMenuIdx, setDraggedMenuIdx] = useState(null);
  const [draggedStoreIdx, setDraggedStoreIdx] = useState(null);
  const [draggedOrderTypeIdx, setDraggedOrderTypeIdx] = useState(null);
  const [draggedCategoryIdx, setDraggedCategoryIdx] = useState(null);

  // 드래그로 순서를 바꾸는 모든 목록에서 공통으로 쓰는 "드롭 위치 표시" 상태
  // { listId, idx, edge: 'before' | 'after' } - 어느 항목의 위/아래로 들어갈지를 나타낸다.
  const [dragIndicator, setDragIndicator] = useState(null);

  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [editingOptionGroupId, setEditingOptionGroupId] = useState(null);
  const [editingOptionGroupName, setEditingOptionGroupName] = useState('');
  const [editingOptionItemId, setEditingOptionItemId] = useState(null);
  const [editingOptionItemDraft, setEditingOptionItemDraft] = useState({ name: '', price: '' });

  // ===== 부가옵션(옵션 그룹 / 옵션) 관련 상태 =====
  // 카테고리와 마찬가지로 "가게(selectedMgmtStore)" 하위에 공통으로 귀속되는 리소스다.
  const [isOptionGroupModalOpen, setIsOptionGroupModalOpen] = useState(false);
  const [optionGroups, setOptionGroups] = useState([]); // 메뉴 관리 탭에서 선택된 가게(selectedMgmtStore)의 옵션 그룹 목록
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupMultiple, setNewGroupMultiple] = useState(false);
  const [newOptionDraft, setNewOptionDraft] = useState({}); // { [group_id]: { name, price } }
  // PC(넓은 화면)에서 옵션 관리 모달을 좌(그룹 목록)/우(선택한 그룹 상세)로 나눠 보여줄 때, 현재 선택된 그룹
  const [selectedOptionGroupIdForModal, setSelectedOptionGroupIdForModal] = useState(null);
  const [isDesktopAddGroupOpen, setIsDesktopAddGroupOpen] = useState(false); // PC 레이아웃에서 "새 옵션 그룹 추가" 폼 펼침 여부

  // 주문 입력(POS) 화면 - 옵션이 있는 메뉴를 클릭했을 때 메뉴 선택 화면에서 바로 펼쳐지는 옵션 선택 영역
  // { menuId, selections: { [group_id]: optionId | optionId[] } }
  const [expandedMenuOptions, setExpandedMenuOptions] = useState(null);

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

  // 옵션 관리 모달(PC 좌/우 레이아웃) - 목록이 바뀌었는데 선택된 그룹이 없거나 삭제되었으면 첫 번째 그룹을 자동 선택
  useEffect(() => {
    if (optionGroups.length === 0) {
      setSelectedOptionGroupIdForModal(null);
      return;
    }
    if (!optionGroups.some(g => g.id === selectedOptionGroupIdForModal)) {
      setSelectedOptionGroupIdForModal(optionGroups[0].id);
    }
  }, [optionGroups]);

  // 월단위/연단위 조회 - 선택된 월/연도가 바뀌면 그 기간에 해당하는 주문을 전체 조회해온다.
  useEffect(() => {
    if (activeTab !== 'sales') return;
    if (salesViewMode === 'monthly' && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      fetchRangeOrders(`${selectedMonth}-01`, `${selectedMonth}-${String(lastDay).padStart(2, '0')}`);
      setDrillDownDate(null);
    } else if (salesViewMode === 'yearly' && selectedYear) {
      fetchRangeOrders(`${selectedYear}-01-01`, `${selectedYear}-12-31`);
    }
  }, [activeTab, salesViewMode, selectedMonth, selectedYear]);

  useEffect(() => {
    if (selectedMgmtStore) {
      fetchCategories(selectedMgmtStore);
      fetchOptionGroups(selectedMgmtStore);
      setSelectedMgmtCategory('전체');
    }
  }, [selectedMgmtStore]);

  useEffect(() => {
    if (selectedPosStore) {
      axios.get(`${API_BASE_URL}/categories?store_tag=${encodeURIComponent(selectedPosStore)}`)
        .then(res => {
          const fetchedCats = res.data;
          setCategories(fetchedCats);
          if (fetchedCats.length > 0) {
            setSelectedPosCategory(fetchedCats[0].name);
          } else {
            setSelectedPosCategory('');
          }
        })
        .catch(err => console.error('POS 카테고리 조회 실패:', err));
    }
  }, [selectedPosStore]);

  useEffect(() => {
    if (newMenu.store_tag) {
      fetchModalCategories(newMenu.store_tag);
      fetchModalOptionGroups(newMenu.store_tag);
    } else {
      setModalCategories([]);
      setModalOptionGroups([]);
    }
  }, [newMenu.store_tag]);

  useEffect(() => {
    if (editingMenuModal?.store_tag) {
      fetchModalCategories(editingMenuModal.store_tag);
      fetchModalOptionGroups(editingMenuModal.store_tag);
    }
  }, [editingMenuModal?.store_tag]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const fetchCategories = async (storeTag = '전체') => {
    try {
      const url = storeTag && storeTag !== '전체'
        ? `${API_BASE_URL}/categories?store_tag=${encodeURIComponent(storeTag)}`
        : `${API_BASE_URL}/categories`;
      const res = await axios.get(url);
      setCategories(res.data);
    } catch (err) {
      console.error('카테고리 조회 실패:', err);
    }
  };

  const fetchModalCategories = async (storeTag) => {
    try {
      const url = `${API_BASE_URL}/categories?store_tag=${encodeURIComponent(storeTag)}`;
      const res = await axios.get(url);
      setModalCategories(res.data);
    } catch (err) {
      console.error('모달 카테고리 조회 실패:', err);
    }
  };

  // 메뉴 관리 탭의 "옵션 관리" 모달용 - 선택된 가게(selectedMgmtStore)의 옵션 그룹 목록
  const fetchOptionGroups = async (storeTag) => {
    if (!storeTag) return setOptionGroups([]);
    try {
      const res = await axios.get(`${API_BASE_URL}/option-groups?store_tag=${encodeURIComponent(storeTag)}`);
      setOptionGroups(res.data);
    } catch (err) {
      console.error('옵션 그룹 조회 실패:', err);
    }
  };

  // 메뉴 등록/수정 모달에서 "이 가게의 옵션 그룹 중 어떤 걸 이 메뉴에 적용할지" 고를 목록
  const fetchModalOptionGroups = async (storeTag) => {
    if (!storeTag) return setModalOptionGroups([]);
    try {
      const res = await axios.get(`${API_BASE_URL}/option-groups?store_tag=${encodeURIComponent(storeTag)}`);
      setModalOptionGroups(res.data);
    } catch (err) {
      console.error('모달 옵션 그룹 조회 실패:', err);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [mRes, stRes, otRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/menus`),
        axios.get(`${API_BASE_URL}/store-tags`),
        axios.get(`${API_BASE_URL}/order-types`),
      ]);
      setMenus(mRes.data);
      setStoreTags(stRes.data);
      setOrderTypes(otRes.data);

      if (stRes.data.length > 0) {
        if (!selectedPosStore) setSelectedPosStore(stRes.data[0].name);
        if (!selectedMgmtStore) setSelectedMgmtStore(stRes.data[0].name);
      }

      if (selectedMgmtStore) {
        fetchCategories(selectedMgmtStore);
      } else if (stRes.data.length > 0) {
        fetchCategories(stRes.data[0].name);
      }

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

      // 월단위/연단위 선택 옵션은 "실제 주문이 존재하는 월/연도"만 보여준다.
      // 기본값은 이번 달/올해가 있으면 그것으로, 없으면 데이터가 있는 것 중 가장 최근 것으로.
      const months = [...new Set(res.data.map(d => d.slice(0, 7)))];
      const currentMonth = getTodayStr().slice(0, 7);
      setSelectedMonth(prev => (prev && months.includes(prev)) ? prev : (months.includes(currentMonth) ? currentMonth : (months[0] || '')));

      const years = [...new Set(res.data.map(d => d.slice(0, 4)))];
      const currentYear = getTodayStr().slice(0, 4);
      setSelectedYear(prev => (prev && years.includes(prev)) ? prev : (years.includes(currentYear) ? currentYear : (years[0] || '')));
    });
  };

  const fetchRangeOrders = (start, end) => {
    axios.get(`${API_BASE_URL}/sales/range?start=${start}&end=${end}`).then(res => setRangeOrders(res.data));
  };

  const fetchDailyOrders = (date) => {
    axios.get(`${API_BASE_URL}/sales/daily?date=${date}`).then(res => setDailyOrders(res.data));
  };

  // 옵션이 없는 일반 메뉴를 바로 장바구니에 담는다.
  const addPlainMenuToCart = (menu) => {
    const cartKey = `menu-${menu.id}-base`;
    setCart(prev => {
      const exist = prev.find(item => item.cart_key === cartKey);
      if (exist) {
        return prev.map(item => item.cart_key === cartKey ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { cart_key: cartKey, menu_id: menu.id, name: menu.name, price: menu.price, quantity: 1, isDiscount: false, options: [] }];
    });
  };

  // 메뉴 카드를 클릭했을 때: 부가옵션이 있으면 메뉴 선택 화면에서 바로 옵션 선택 영역을 펼치고,
  // 없으면 바로 장바구니에 담는다. 이미 펼쳐진 메뉴를 다시 클릭하면 접는다.
  const handleMenuCardClick = (menu) => {
    const groups = menu.options || [];
    if (groups.length === 0) {
      addPlainMenuToCart(menu);
      return;
    }

    if (expandedMenuOptions?.menuId === menu.id) {
      setExpandedMenuOptions(null);
      return;
    }

    // 필수 옵션 그룹은 매번 다시 고르지 않아도 되도록 첫 번째 옵션을 기본 선택해 둔다.
    const initialSelections = {};
    groups.forEach(g => {
      const opts = g.options || [];
      if (g.is_required && opts.length > 0) {
        initialSelections[g.id] = g.allow_multiple ? [opts[0].id] : opts[0].id;
      } else {
        initialSelections[g.id] = g.allow_multiple ? [] : '';
      }
    });
    setExpandedMenuOptions({ menuId: menu.id, selections: initialSelections });
  };

  const toggleOptionSelection = (group, optionId) => {
    setExpandedMenuOptions(prev => {
      if (!prev) return prev;
      const selections = { ...prev.selections };
      if (group.allow_multiple) {
        const current = Array.isArray(selections[group.id]) ? selections[group.id] : [];
        selections[group.id] = current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId];
      } else {
        // 단일 선택 그룹: 필수가 아닌 경우, 이미 선택된 옵션을 다시 누르면 선택을 해제할 수 있게 한다.
        // (선택지가 1개뿐인 옵션 그룹에서 체크 후 되돌릴 방법이 없던 문제 수정)
        selections[group.id] = (!group.is_required && selections[group.id] === optionId) ? '' : optionId;
      }
      return { ...prev, selections };
    });
  };

  // "장바구니 담기"를 눌렀을 때: 필수 옵션 검증 후 옵션이 반영된 금액으로 장바구니에 추가한다.
  // 선택된 옵션들은 item.options에 그대로 담아두고, 표시는 장바구니 쪽에서 메뉴명 하위에 여러 줄로 풀어서 보여준다.
  const confirmOptionSelection = () => {
    if (!expandedMenuOptions) return;
    const menu = menus.find(m => m.id === expandedMenuOptions.menuId);
    if (!menu) return;
    const { selections } = expandedMenuOptions;
    const groups = menu.options || [];

    for (const g of groups) {
      if (!g.is_required) continue;
      const sel = selections[g.id];
      const isEmpty = g.allow_multiple ? (!sel || sel.length === 0) : !sel;
      if (isEmpty) {
        return alert(`"${g.name}" 옵션을 선택해주세요.`);
      }
    }

    const chosenOptions = [];
    groups.forEach(g => {
      const sel = selections[g.id];
      const ids = g.allow_multiple ? (sel || []) : (sel ? [sel] : []);
      ids.forEach(optId => {
        const opt = (g.options || []).find(o => o.id === optId);
        if (opt) {
          chosenOptions.push({
            group_id: g.id,
            group_name: g.name,
            option_id: opt.id,
            option_name: opt.name,
            extra_price: opt.extra_price || 0
          });
        }
      });
    });

    const extraTotal = chosenOptions.reduce((sum, o) => sum + (o.extra_price || 0), 0);
    const cartKey = `menu-${menu.id}-opt-${chosenOptions.map(o => o.option_id).sort().join('_') || 'none'}`;

    setCart(prev => {
      const exist = prev.find(item => item.cart_key === cartKey);
      if (exist) {
        return prev.map(item => item.cart_key === cartKey ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        cart_key: cartKey,
        menu_id: menu.id,
        name: menu.name,
        price: menu.price + extraTotal,
        quantity: 1,
        isDiscount: false,
        options: chosenOptions
      }];
    });

    setExpandedMenuOptions(null);
  };

  const addDiscountToCart = () => {
    const amt = Number(discountAmount);
    if (!amt || amt <= 0) return alert('유효한 할인 금액을 입력해주세요.');

    const cartKey = `discount-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setCart(prev => [...prev, {
      cart_key: cartKey,
      menu_id: 0,
      name: discountName || '금액 할인',
      price: -amt,
      quantity: 1,
      isDiscount: true,
      options: []
    }]);

    setDiscountAmount('');
    setIsDiscountModalOpen(false);
    showToast('할인 항목이 추가되었습니다.');
  };

  const updateQuantity = (cartKey, change) => {
    setCart(prev => prev.map(item => {
      if (item.cart_key === cartKey) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (cartKey) => {
    setCart(prev => prev.filter(item => item.cart_key !== cartKey));
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
        price: item.price,
        options: item.options || []
      })),
      created_at: buildCreatedAtISO(orderDate)
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

  const handleAddCategory = async () => {
    if (!newCategoryInput) return;
    if (!selectedMgmtStore) {
      return alert('카테고리를 추가할 특정 가게를 먼저 선택해주세요!');
    }

    try {
      await axios.post(`${API_BASE_URL}/categories`, {
        name: newCategoryInput,
        store_tag: selectedMgmtStore
      });
      setNewCategoryInput('');
      showToast('카테고리가 추가되었습니다.');
      fetchCategories(selectedMgmtStore);
      fetchInitialData();
    } catch (err) {
      alert(`카테고리 추가 실패: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('이 카테고리를 삭제하시겠습니까? 속해 있던 메뉴는 "카테고리 없음"으로 변경됩니다.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/categories/${id}`);
      showToast('카테고리가 삭제되었습니다.');
      fetchCategories(selectedMgmtStore);
      fetchInitialData();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  // ===== 드래그 앤 드롭 공통 유틸 =====
  // 마우스가 항목의 위쪽 절반에 있으면 그 항목 "앞"에, 아래쪽 절반에 있으면 "뒤"에 놓일 것임을 표시해준다.
  const handleDragOverItem = (listId, idx) => (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const edge = (e.clientY - rect.top) > rect.height / 2 ? 'after' : 'before';
    setDragIndicator(prev => (prev && prev.listId === listId && prev.idx === idx && prev.edge === edge) ? prev : { listId, idx, edge });
  };

  const clearDragIndicator = () => setDragIndicator(null);

  // 드롭될 위치에 파란 선을 그려주는 스타일 (레이아웃에 영향을 주지 않도록 box-shadow로 표현)
  const getDropLineStyle = (listId, idx) => {
    if (!dragIndicator || dragIndicator.listId !== listId || dragIndicator.idx !== idx) return {};
    return dragIndicator.edge === 'after'
      ? { boxShadow: 'inset 0 -3px 0 0 #2563eb' }
      : { boxShadow: 'inset 0 3px 0 0 #2563eb' };
  };

  // 드래그해서 놓은 위치(항목의 앞/뒤)를 그대로 반영해 배열 순서를 바꾼다.
  const reorderList = (list, dragIdx, dropIdx, edge) => {
    const newList = [...list];
    const [moved] = newList.splice(dragIdx, 1);
    let insertIdx = edge === 'after' ? dropIdx + 1 : dropIdx;
    if (dragIdx < insertIdx) insertIdx -= 1; // 앞쪽 항목을 제거하면서 한 칸씩 당겨진 것을 보정
    newList.splice(insertIdx, 0, moved);
    return newList;
  };

  const handleCategoryDrop = async (dragIdx, dropIdx) => {
    const edge = dragIndicator?.edge || 'before';
    clearDragIndicator();
    if (dragIdx === null || dragIdx === dropIdx) return;
    const newList = reorderList(categories, dragIdx, dropIdx, edge);
    setCategories(newList);
    setDraggedCategoryIdx(null);

    try {
      await axios.put(`${API_BASE_URL}/categories/order`, { items: newList.map((item, index) => ({ id: item.id, display_order: index })) });
      showToast('카테고리 순서가 저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('순서 저장 실패');
    }
  };

  const startEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleRenameCategory = async () => {
    if (!editingCategoryName.trim()) return alert('카테고리명을 입력해주세요.');
    try {
      await axios.put(`${API_BASE_URL}/categories/${editingCategoryId}`, { name: editingCategoryName.trim() });
      showToast('카테고리명이 수정되었습니다.');
      cancelEditCategory();
      fetchCategories(selectedMgmtStore);
      fetchInitialData();
    } catch (err) {
      alert(`카테고리명 수정 실패: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleStoreTagDrop = async (dragIdx, dropIdx) => {
    const edge = dragIndicator?.edge || 'before';
    clearDragIndicator();
    if (dragIdx === null || dragIdx === dropIdx) return;
    const newList = reorderList(storeTags, dragIdx, dropIdx, edge);
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
    const edge = dragIndicator?.edge || 'before';
    clearDragIndicator();
    if (dragIdx === null || dragIdx === dropIdx) return;
    const newList = reorderList(orderTypes, dragIdx, dropIdx, edge);
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
    if (!newMenu.name || !newMenu.price || !newMenu.store_tag) return alert('필수 항목을 입력해 주세요.');
    await axios.post(`${API_BASE_URL}/menus`, {
      ...newMenu,
      category_id: newMenu.category_id === '' ? null : newMenu.category_id
    });
    showToast('✅ 새 메뉴가 등록되었습니다.');
    setIsCreateModalOpen(false);
    fetchInitialData();
  };

  const handleUpdateMenuModal = async () => {
    const payload = {
      name: editingMenuModal.name,
      price: editingMenuModal.price,
      store_tag: editingMenuModal.store_tag,
      category_id: editingMenuModal.category_id === '' ? null : Number(editingMenuModal.category_id),
      option_group_ids: editingMenuModal.option_group_ids || []
    };

    await axios.put(`${API_BASE_URL}/menus/${editingMenuModal.id}`, payload);
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
        price: item.price,
        options: item.options || []
      })),
      // 저장 일자(날짜)만 바뀌었을 때도 원래 주문의 시/분/초는 그대로 유지한다.
      // (예전에는 날짜만 보내서 수정할 때마다 시각이 자정(한국시간 오전 9시)으로 초기화되던 문제가 있었다.)
      created_at: buildCreatedAtISO(editingOrderModal.created_at, editingOrderModal.created_at_original)
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

  // ===== 부가옵션 관리 (메뉴 관리 탭 - "옵션 관리" 모달, 가게(selectedMgmtStore) 하위 공통 리소스) =====
  const refreshOptionGroupsEverywhere = () => {
    // 옵션 관리 모달 목록 + 메뉴 목록(각 메뉴에 연결된 그룹 카운트/내용) 을 함께 최신화한다.
    fetchOptionGroups(selectedMgmtStore);
    fetchInitialData();
  };

  const handleAddOptionGroup = async () => {
    if (!newGroupName) return alert('옵션 그룹명을 입력해주세요.');
    if (!selectedMgmtStore) return alert('옵션 그룹을 추가할 가게를 먼저 선택해주세요!');
    try {
      await axios.post(`${API_BASE_URL}/option-groups`, {
        name: newGroupName,
        store_tag: selectedMgmtStore,
        is_required: newGroupRequired,
        allow_multiple: newGroupMultiple
      });
      setNewGroupName('');
      setNewGroupRequired(false);
      setNewGroupMultiple(false);
      showToast('옵션 그룹이 추가되었습니다.');
      refreshOptionGroupsEverywhere();
    } catch (err) {
      alert(`옵션 그룹 추가 실패: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteOptionGroup = async (groupId) => {
    if (!window.confirm('이 옵션 그룹과 하위 옵션을 모두 삭제하시겠습니까? 이 그룹을 사용 중인 메뉴에서도 함께 제거됩니다.')) return;
    try {
      await axios.delete(`${API_BASE_URL}/option-groups/${groupId}`);
      showToast('옵션 그룹이 삭제되었습니다.');
      refreshOptionGroupsEverywhere();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const startEditOptionGroup = (group) => {
    setEditingOptionGroupId(group.id);
    setEditingOptionGroupName(group.name);
  };

  const cancelEditOptionGroup = () => {
    setEditingOptionGroupId(null);
    setEditingOptionGroupName('');
  };

  const handleRenameOptionGroup = async () => {
    if (!editingOptionGroupName.trim()) return alert('옵션 그룹명을 입력해주세요.');
    try {
      await axios.put(`${API_BASE_URL}/option-groups/${editingOptionGroupId}`, { name: editingOptionGroupName.trim() });
      showToast('옵션 그룹명이 수정되었습니다.');
      cancelEditOptionGroup();
      refreshOptionGroupsEverywhere();
    } catch (err) {
      alert(`옵션 그룹명 수정 실패: ${err.response?.data?.error || err.message}`);
    }
  };

  const startEditOptionItem = (opt) => {
    setEditingOptionItemId(opt.id);
    setEditingOptionItemDraft({ name: opt.name, price: opt.extra_price || '' });
  };

  const cancelEditOptionItem = () => {
    setEditingOptionItemId(null);
    setEditingOptionItemDraft({ name: '', price: '' });
  };

  const handleRenameOptionItem = async () => {
    if (!editingOptionItemDraft.name.trim()) return alert('옵션명을 입력해주세요.');
    try {
      await axios.put(`${API_BASE_URL}/option-items/${editingOptionItemId}`, {
        name: editingOptionItemDraft.name.trim(),
        extra_price: editingOptionItemDraft.price === '' ? 0 : Number(editingOptionItemDraft.price)
      });
      showToast('옵션이 수정되었습니다.');
      cancelEditOptionItem();
      refreshOptionGroupsEverywhere();
    } catch (err) {
      alert(`옵션 수정 실패: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleAddOption = async (groupId) => {
    const draft = newOptionDraft[groupId] || { name: '', price: '' };
    if (!draft.name) return alert('옵션명을 입력해주세요.');
    try {
      await axios.post(`${API_BASE_URL}/option-groups/${groupId}/items`, {
        name: draft.name,
        extra_price: draft.price === '' || draft.price === undefined ? 0 : Number(draft.price)
      });
      setNewOptionDraft(prev => ({ ...prev, [groupId]: { name: '', price: '' } }));
      showToast('옵션이 추가되었습니다.');
      refreshOptionGroupsEverywhere();
    } catch (err) {
      alert(`옵션 추가 실패: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteOption = async (optionId) => {
    if (!window.confirm('이 옵션을 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/option-items/${optionId}`);
      showToast('옵션이 삭제되었습니다.');
      refreshOptionGroupsEverywhere();
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const handleGenericDrop = (list, setList, dragIdx, dropIdx) => {
    const edge = dragIndicator?.edge || 'before';
    clearDragIndicator();
    if (dragIdx === null || dragIdx === dropIdx) return;
    setList(reorderList(list, dragIdx, dropIdx, edge));
  };

  // 주문 상세 내역에 표시할 "메뉴명 (선택옵션1, 선택옵션2)" 형태의 텍스트를 만든다.
  const formatOrderItemLabel = (item) => {
    const baseName = item.menus?.name || '할인';
    const optNames = (item.options || []).map(o => o.option_name).filter(Boolean);
    return optNames.length > 0 ? `${baseName} (${optNames.join(', ')})` : baseName;
  };

  // 가게구분/배달구분/결제수단 필터 - 일단위/월단위/연단위 모두 동일한 조건으로 사용한다.
  const orderMatchesSalesFilter = (order) => {
    const storeMatch = filterStore === '전체' || order.order_items.some(i => i.menus?.store_tag === filterStore);
    const typeMatch = filterOrderType === '전체' || order.order_types?.name === filterOrderType;
    const paymentMatch = filterPaymentType === '전체' || order.payment_type === filterPaymentType;
    return storeMatch && typeMatch && paymentMatch;
  };

  const filteredDailyOrders = dailyOrders.filter(orderMatchesSalesFilter);
  const filteredRangeOrders = rangeOrders.filter(orderMatchesSalesFilter);

  // 조회 월/연도 선택지 - 실제 주문이 존재하는 월/연도만, 최근 순으로 보여준다.
  const availableMonths = [...new Set(dateList.map(d => d.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
  const availableYears = [...new Set(dateList.map(d => d.slice(0, 4)))].sort((a, b) => b.localeCompare(a));

  // 월단위: 선택된 월의 일자별(1일~말일) 건수/금액 집계 - 주문이 없는 날짜도 0으로 채워서 추이를 이어 보여준다.
  const monthlyChartData = (() => {
    if (salesViewMode !== 'monthly' || !selectedMonth) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const buckets = {};
    filteredRangeOrders.forEach(o => {
      const day = (o.created_at || '').split('T')[0];
      if (!buckets[day]) buckets[day] = { count: 0, amount: 0 };
      buckets[day].count += 1;
      buckets[day].amount += o.total_amount || 0;
    });
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dateStr = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
      const bucket = buckets[dateStr] || { count: 0, amount: 0 };
      return { key: dateStr, label: String(i + 1), ...bucket };
    });
  })();

  // 연단위: 선택된 연도의 월별(1월~12월) 건수/금액 집계
  const yearlyChartData = (() => {
    if (salesViewMode !== 'yearly' || !selectedYear) return [];
    const buckets = {};
    filteredRangeOrders.forEach(o => {
      const month = (o.created_at || '').slice(0, 7);
      if (!buckets[month]) buckets[month] = { count: 0, amount: 0 };
      buckets[month].count += 1;
      buckets[month].amount += o.total_amount || 0;
    });
    return Array.from({ length: 12 }, (_, i) => {
      const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
      const bucket = buckets[monthStr] || { count: 0, amount: 0 };
      return { key: monthStr, label: `${i + 1}월`, ...bucket };
    });
  })();

  // 월단위 화면에서 추이 차트의 특정 일자를 클릭했을 때 그 날의 주문만 골라낸다 (조회 전용, 수정/삭제 없음).
  const drillDownOrders = drillDownDate
    ? filteredRangeOrders.filter(o => (o.created_at || '').split('T')[0] === drillDownDate)
    : [];

  // 가게구분/배달구분/결제수단 필터 UI - 일단위/월단위/연단위 화면에서 공통으로 사용한다.
  const renderSalesFilterRow = () => (
    <div style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: '12px', marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', boxSizing: 'border-box', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: isMobile ? '100%' : '200px' }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', flexShrink: 0 }}>가게구분</span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button onClick={() => setFilterStore('전체')} style={{ padding: '4px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '11px', background: filterStore === '전체' ? '#2563eb' : '#e2e8f0', color: filterStore === '전체' ? '#fff' : '#334155', fontWeight: 'bold' }}>전체</button>
          {storeTags.map(st => (
            <button key={st.id} onClick={() => setFilterStore(st.name)} style={{ padding: '4px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '11px', background: filterStore === st.name ? '#2563eb' : '#e2e8f0', color: filterStore === st.name ? '#fff' : '#334155', fontWeight: 'bold' }}>{st.name}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: isMobile ? '100%' : '200px' }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', flexShrink: 0 }}>배달구분</span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button onClick={() => setFilterOrderType('전체')} style={{ padding: '4px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '11px', background: filterOrderType === '전체' ? '#2563eb' : '#e2e8f0', color: filterOrderType === '전체' ? '#fff' : '#334155', fontWeight: 'bold' }}>전체</button>
          {orderTypes.map(ot => (
            <button key={ot.id} onClick={() => setFilterOrderType(ot.name)} style={{ padding: '4px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '11px', background: filterOrderType === ot.name ? '#2563eb' : '#e2e8f0', color: filterOrderType === ot.name ? '#fff' : '#334155', fontWeight: 'bold' }}>{ot.name}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', flexShrink: '0' }}>결제수단</span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {['전체', '카드', '현금'].map(pt => (
            <button key={pt} onClick={() => setFilterPaymentType(pt)} style={{ padding: '4px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '11px', background: filterPaymentType === pt ? '#2563eb' : '#e2e8f0', color: filterPaymentType === pt ? '#fff' : '#334155', fontWeight: 'bold' }}>{pt}</button>
          ))}
        </div>
      </div>
    </div>
  );

  // 총 주문건수 / 총 매출금액 카드 - 일단위/월단위/연단위 공통
  const renderSalesTotalCards = (orders) => (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
      <div style={{ flex: 1, background: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
        <div style={{ fontSize: '12px', color: '#1e40af' }}>총 주문 건수</div>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e3a8a' }}>{orders.length} 건</div>
      </div>
      <div style={{ flex: 1, background: '#ecfdf5', padding: '12px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
        <div style={{ fontSize: '12px', color: '#065f46' }}>총 매출 금액</div>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#064e3b' }}>{orders.reduce((s, o) => s + o.total_amount, 0).toLocaleString()} 원</div>
      </div>
    </div>
  );

  // 월단위/연단위 추이 차트 - 외부 차트 라이브러리 없이 막대 2개(금액/건수)로 표현.
  // clickable=true(월단위)면 막대를 눌러 그 날짜의 주문 목록을 아래에서 조회할 수 있다.
  const renderTrendChart = (data, { clickable = false, selectedKey = null, onSelect = null } = {}) => {
    const maxAmount = Math.max(1, ...data.map(d => d.amount));
    const maxCount = Math.max(1, ...data.map(d => d.count));
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '150px', overflowX: 'auto', padding: '8px 4px', borderBottom: '2px solid #e2e8f0' }}>
          {data.map(d => {
            const isSelected = clickable && selectedKey === d.key;
            return (
              <div
                key={d.key}
                onClick={clickable ? () => onSelect(d.key) : undefined}
                title={`${d.label}: ${d.count}건 / ${d.amount.toLocaleString()}원`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minWidth: '24px', flexShrink: 0, height: '100%', cursor: clickable ? 'pointer' : 'default', background: isSelected ? '#eff6ff' : 'transparent', borderRadius: '4px', padding: '2px', boxSizing: 'border-box' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '110px' }}>
                  <div style={{ width: '8px', height: `${(d.amount / maxAmount) * 100}%`, minHeight: d.amount > 0 ? '2px' : '0', background: isSelected ? '#2563eb' : '#93c5fd', borderRadius: '2px 2px 0 0' }} />
                  <div style={{ width: '8px', height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? '2px' : '0', background: isSelected ? '#059669' : '#6ee7b7', borderRadius: '2px 2px 0 0' }} />
                </div>
                <div style={{ fontSize: '10px', color: isSelected ? '#2563eb' : '#64748b', marginTop: '4px', fontWeight: isSelected ? 'bold' : 'normal' }}>{d.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
          <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#93c5fd', marginRight: '4px', borderRadius: '2px' }} />금액</span>
          <span><span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#6ee7b7', marginRight: '4px', borderRadius: '2px' }} />건수</span>
          {clickable && <span style={{ color: '#94a3b8' }}>막대를 누르면 그 날짜의 주문 목록을 볼 수 있습니다.</span>}
        </div>
      </div>
    );
  };

  // 월단위 화면의 일자별 드릴다운 - 수정/삭제 없이 조회만 가능한 간단한 목록.
  const renderReadOnlyOrderList = (orders) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {orders.length === 0 && (
        <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '14px' }}>해당 일자의 주문 내역이 없습니다.</div>
      )}
      {orders.map(order => {
        const dateObj = new Date(order.created_at);
        const formattedTime = !isNaN(dateObj.getTime())
          ? `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`
          : order.created_at;
        return (
          <div key={order.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>{formattedTime}</span>
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{order.payment_type || '카드'}</span>
              <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{order.order_types?.name || '매장'}</span>
            </div>
            <div style={{ fontSize: '12px', flex: 1, minWidth: isMobile ? '100%' : 0, wordBreak: 'break-all' }}>
              {order.order_items?.map(i => `${formatOrderItemLabel(i)}(${i.quantity})`).join(', ')}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2563eb', flexShrink: 0 }}>{order.total_amount.toLocaleString()}원</div>
          </div>
        );
      })}
    </div>
  );

  // 옵션 그룹 하나의 상세 내용(그룹명 헤더 + 옵션 목록 + 옵션 추가 폼).
  // 모바일에서는 그룹마다 이 내용을 카드로 쌓아 보여주고, PC에서는 좌측에서 고른 그룹 하나만 우측에 보여준다.
  const renderOptionGroupDetail = (group) => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
        {editingOptionGroupId === group.id ? (
          <>
            <input
              autoFocus
              value={editingOptionGroupName}
              onChange={e => setEditingOptionGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameOptionGroup(); if (e.key === 'Escape') cancelEditOptionGroup(); }}
              style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid #2563eb', fontSize: '12px' }}
            />
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button onClick={handleRenameOptionGroup} style={{ padding: '4px 8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>저장</button>
              <button onClick={cancelEditOptionGroup} style={{ padding: '4px 8px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>취소</button>
            </div>
          </>
        ) : (
          <>
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{group.name}</span>
              <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: group.is_required ? '#fee2e2' : '#e0e7ff', color: group.is_required ? '#b91c1c' : '#3730a3', fontWeight: 'bold' }}>
                {group.is_required ? '필수' : '선택'}{group.allow_multiple ? ' · 중복가능' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button onClick={() => startEditOptionGroup(group)} style={{ padding: '4px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>수정</button>
              <button onClick={() => handleDeleteOptionGroup(group.id)} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>그룹삭제</button>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
        {(group.option_items || []).map(opt => (
          <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', gap: '8px' }}>
            {editingOptionItemId === opt.id ? (
              <>
                <input
                  autoFocus
                  value={editingOptionItemDraft.name}
                  onChange={e => setEditingOptionItemDraft(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameOptionItem(); if (e.key === 'Escape') cancelEditOptionItem(); }}
                  style={{ flex: 2, padding: '5px 7px', borderRadius: '4px', border: '1px solid #2563eb', fontSize: '12px' }}
                />
                <input
                  type="number"
                  value={editingOptionItemDraft.price}
                  onChange={e => setEditingOptionItemDraft(prev => ({ ...prev, price: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameOptionItem(); if (e.key === 'Escape') cancelEditOptionItem(); }}
                  style={{ flex: 1, padding: '5px 7px', borderRadius: '4px', border: '1px solid #2563eb', fontSize: '12px' }}
                />
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button onClick={handleRenameOptionItem} style={{ padding: '3px 6px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>저장</button>
                  <button onClick={cancelEditOptionItem} style={{ padding: '3px 6px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>취소</button>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{opt.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: opt.extra_price > 0 ? '#2563eb' : '#94a3b8' }}>
                    {opt.extra_price > 0 ? `+${opt.extra_price.toLocaleString()}원` : '추가금액 없음'}
                  </span>
                  <button onClick={() => startEditOptionItem(opt)} style={{ padding: '3px 6px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>수정</button>
                  <button onClick={() => handleDeleteOption(opt.id)} style={{ padding: '3px 6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>X</button>
                </div>
              </>
            )}
          </div>
        ))}
        {(group.option_items || []).length === 0 && (
          <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '6px' }}>옵션이 없습니다.</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          placeholder="예: 곱빼기"
          value={(newOptionDraft[group.id] || {}).name || ''}
          onChange={e => setNewOptionDraft(prev => ({ ...prev, [group.id]: { ...(prev[group.id] || {}), name: e.target.value } }))}
          style={{ flex: 2, padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
        />
        <input
          type="number"
          placeholder="추가금액"
          value={(newOptionDraft[group.id] || {}).price || ''}
          onChange={e => setNewOptionDraft(prev => ({ ...prev, [group.id]: { ...(prev[group.id] || {}), price: e.target.value } }))}
          style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
        />
        <button onClick={() => handleAddOption(group.id)} style={{ padding: '7px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>추가</button>
      </div>
    </>
  );

  // "새 옵션 그룹 추가" 폼 - 모바일(항상 하단 노출)과 PC(버튼을 눌러야 펼쳐짐)에서 공용으로 사용한다.
  const renderAddOptionGroupForm = () => (
    <>
      <input
        placeholder="예: 곱빼기 선택, 면 종류 선택"
        value={newGroupName}
        onChange={e => setNewGroupName(e.target.value)}
        style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px', marginBottom: '8px' }}
      />
      <div style={{ display: 'flex', gap: '14px', marginBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
          <input type="checkbox" checked={newGroupRequired} onChange={e => setNewGroupRequired(e.target.checked)} />
          필수 선택
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
          <input type="checkbox" checked={newGroupMultiple} onChange={e => setNewGroupMultiple(e.target.checked)} />
          중복 선택 허용
        </label>
      </div>
      <button onClick={() => { handleAddOptionGroup(); setIsDesktopAddGroupOpen(false); }} style={{ width: '100%', padding: '10px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>옵션 그룹 추가</button>
    </>
  );

  return (
    <div style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', margin: '0 auto', padding: '12px', fontFamily: "'Pretendard', sans-serif", backgroundColor: '#f4f6f8', minHeight: '100vh', color: '#333', boxSizing: 'border-box' }}>

      {toastMessage && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: '#1e293b', color: '#fff', padding: '12px 20px', borderRadius: '8px', zIndex: 9999, fontWeight: 'bold' }}>
          {toastMessage}
        </div>
      )}

      {/* 상단 네비게이션 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: '#fff', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', flexDirection: isMobile ? 'column' : 'row', gap: '10px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
          <button onClick={() => setActiveTab('pos')} style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'pos' ? '#2563eb' : '#f1f5f9', color: activeTab === 'pos' ? '#fff' : '#64748b', fontSize: '14px' }}>주문 입력</button>
          <button onClick={() => setActiveTab('sales')} style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'sales' ? '#2563eb' : '#f1f5f9', color: activeTab === 'sales' ? '#fff' : '#64748b', fontSize: '14px' }}>매출정산</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
          <button onClick={() => setActiveTab('menuMgmt')} style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'menuMgmt' ? '#10b981' : '#f1f5f9', color: activeTab === 'menuMgmt' ? '#fff' : '#64748b', fontSize: '14px' }}>⚙️ 메뉴 관리</button>
          <button onClick={() => setActiveTab('categoryMgmt')} style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'categoryMgmt' ? '#8b5cf6' : '#f1f5f9', color: activeTab === 'categoryMgmt' ? '#fff' : '#64748b', fontSize: '14px' }}>🏷️ 가게/배달</button>
        </div>
      </div>

      {/* 1. POS 영역 */}
      {activeTab === 'pos' && (
        <div style={{ display: 'flex', gap: '16px', flexDirection: isMobile ? 'column' : 'row', boxSizing: 'border-box', width: '100%', alignItems: 'flex-start' }}>

          {/* 장바구니 및 주문 입력 패널 */}
          <div style={{ width: isMobile ? '100%' : '420px', flexShrink: 0, background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '16px' }}>주문 내역</h2>
              <button onClick={() => setIsDiscountModalOpen(true)} style={{ padding: '6px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                🏷️ 금액 할인 추가
              </button>
            </div>

            {/* [개선 2 반영] 저장 일자: 좌우 배치 */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', width: '100px', flexShrink: 0 }}>저장 일자</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>

            {/* [개선 2 반영] 주문 / 배달 구분: 좌우 배치 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px', gap: '12px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', width: '100px', flexShrink: 0, paddingTop: '6px' }}>주문 / 배달 구분</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                {orderTypes.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => setOrderType(ot.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: orderType === ot.id ? '#10b981' : '#f1f5f9',
                      color: orderType === ot.id ? '#fff' : '#64748b'
                    }}
                  >
                    {ot.name}
                  </button>
                ))}
              </div>
            </div>

            {/* [개선 2 반영] 결제 구분: 좌우 배치 */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', gap: '12px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', width: '100px', flexShrink: 0 }}>결제 구분</label>
              <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                {['카드', '현금'].map(pt => (
                  <button
                    key={pt}
                    onClick={() => setPaymentType(pt)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '16px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
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

            <div style={{ width: '100%', maxHeight: '240px', overflowY: 'auto', marginBottom: '14px', boxSizing: 'border-box' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', textAlign: 'left', height: '32px' }}>
                    <th style={{ width: '40%' }}>메뉴 / 할인</th><th style={{ width: '25%' }}>수량</th><th style={{ width: '25%', textAlign: 'right' }}>금액</th><th style={{ width: '10%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.cart_key} style={{ borderBottom: '1px solid #f8fafc', minHeight: '40px', color: item.isDiscount ? '#dc2626' : '#333' }}>
                      <td style={{ fontWeight: 'bold', verticalAlign: 'top', paddingTop: '8px', paddingBottom: '8px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        {(item.options || []).map((o, i) => (
                          <div key={i} style={{ fontSize: '10px', fontWeight: 'normal', color: '#64748b', paddingLeft: '10px', marginTop: '2px' }}>
                            – {o.option_name}{o.extra_price > 0 ? ` (+${o.extra_price.toLocaleString()}원)` : ''}
                          </div>
                        ))}
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: '8px' }}>
                        {!item.isDiscount ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <button onClick={() => updateQuantity(item.cart_key, -1)} style={{ padding: '2px 5px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>-</button>
                            <span style={{ fontWeight: 'bold', fontSize: '12px', minWidth: '14px', textAlign: 'center' }}>{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.cart_key, 1)} style={{ padding: '2px 5px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>+</button>
                          </div>
                        ) : (
                          <span>1</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px', verticalAlign: 'top', paddingTop: '8px' }}>{(item.price * item.quantity).toLocaleString()}원</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '8px' }}>
                        <button onClick={() => removeFromCart(item.cart_key)} style={{ padding: '3px 6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>X</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>총 결제 금액</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>{cart.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()}원</span>
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
                  fontSize: '15px',
                  fontWeight: 'bold',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? '저장 중...' : '결제 및 주문 저장'}
              </button>
            </div>
          </div>

          {/* 메뉴 선택 패널 */}
          <div style={{ flex: 1, background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
              {storeTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedPosStore(tag.name)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '16px',
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedPosStore === tag.name ? '#0f172a' : '#f1f5f9',
                    color: selectedPosStore === tag.name ? '#fff' : '#64748b',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    flexShrink: 0
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedPosCategory(cat.name)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedPosCategory === cat.name ? '#2563eb' : '#f1f5f9',
                    color: selectedPosCategory === cat.name ? '#fff' : '#64748b',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    flexShrink: 0
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {menus.filter(m => {
                const storeMatch = !selectedPosStore || m.store_tag === selectedPosStore;
                const menuCatName = m.categories?.name || '카테고리 없음';
                const catMatch = selectedPosCategory === '' || menuCatName === selectedPosCategory;
                return storeMatch && catMatch;
              }).map(m => {
                const isExpanded = expandedMenuOptions?.menuId === m.id;
                return (
                  <button key={m.id} onClick={() => handleMenuCardClick(m)} style={{ padding: '12px', background: isExpanded ? '#eff6ff' : '#f8fafc', border: isExpanded ? '2px solid #2563eb' : '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box', position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ fontSize: '9px', background: '#dbeafe', color: '#1e40af', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>{m.store_tag || '미지정'}</span>
                      <span style={{ fontSize: '9px', background: '#e0e7ff', color: '#3730a3', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>{m.categories?.name || '없음'}</span>
                      {(m.options || []).length > 0 && (
                        <span style={{ fontSize: '9px', background: '#fef3c7', color: '#92400e', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>옵션</span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', wordBreak: 'break-all' }}>{m.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{m.price.toLocaleString()}원</div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* 2. 매출정산 */}
      {activeTab === 'sales' && (
        <div style={{ display: 'flex', gap: '16px', flexDirection: 'column', boxSizing: 'border-box', width: '100%' }}>

          {/* 일단위 / 월단위 / 연단위 서브탭 */}
          <div style={{ width: '100%', background: '#fff', padding: '8px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box', display: 'flex', gap: '8px' }}>
            {[{ key: 'daily', label: '일단위' }, { key: 'monthly', label: '월단위' }, { key: 'yearly', label: '연단위' }].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSalesViewMode(tab.key)}
                style={{ flex: 1, padding: '9px 0', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: salesViewMode === tab.key ? '#0f172a' : '#f1f5f9', color: salesViewMode === tab.key ? '#fff' : '#64748b', fontSize: '13px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ===== 일단위 (기존 화면 그대로) ===== */}
          {salesViewMode === 'daily' && (
            <>
              <div style={{ width: '100%', background: '#fff', padding: '14px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '15px' }}>일자 목록</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      backgroundColor: '#f8fafc',
                      color: '#1e293b',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {dateList.length === 0 && <option value="">등록된 매출 날짜가 없습니다</option>}
                    {dateList.map(date => (
                      <option key={date} value={date}>
                        {date} {date === getTodayStr() ? '(오늘)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ width: '100%', background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}>
                <h2 style={{ marginTop: 0, marginBottom: '14px', fontSize: '16px' }}>{selectedDate} 매출 상세</h2>

                {renderSalesFilterRow()}
                {renderSalesTotalCards(filteredDailyOrders)}

            {/* [개선 3 반영] 테이블 가로스크롤 방지 및 모바일/좁은 화면 대응 2열 카드 배열 (isMobile 여부에 따라 동적 렌더링) */}
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredDailyOrders.map((order) => {
                  const dateObj = new Date(order.created_at);
                  // 정산 화면은 이미 선택된 하루(일자) 기준으로 보고 있으므로, 날짜는 빼고 시간만 표시한다.
                  const formattedTime = !isNaN(dateObj.getTime())
                    ? `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`
                    : order.created_at;

                  return (
                    <div key={order.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: '#64748b' }}>
                        <span>{formattedTime}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{order.payment_type || '카드'}</span>
                          <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{order.order_types?.name || '매장'}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', wordBreak: 'break-all' }}>
                        {order.order_items?.map(i => `${formatOrderItemLabel(i)}(${i.quantity})`).join(', ')}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#2563eb' }}>{order.total_amount.toLocaleString()}원</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => setEditingOrderModal({
                            ...order,
                            created_at: order.created_at ? order.created_at.split('T')[0] : getTodayStr(),
                            created_at_original: order.created_at,
                            order_items: order.order_items.map(item => ({
                              menu_id: item.menu_id,
                              name: item.menus?.name || '할인/기타',
                              price: item.price,
                              quantity: item.quantity,
                              isDiscount: item.menu_id === null || item.price < 0,
                              options: item.options || []
                            }))
                          })} style={{ padding: '4px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>수정</button>
                          <button onClick={() => handleDeleteOrder(order.id)} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>삭제</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', height: '40px', color: '#64748b' }}>
                      <th style={{ width: '30px' }}></th>
                      <th style={{ width: '60px' }}>시간</th>
                      <th style={{ width: '75px' }}>결제</th>
                      <th style={{ width: '85px' }}>구분</th>
                      <th style={{ textAlign: 'left', paddingLeft: '10px', minWidth: '180px' }}>상세 내역</th>
                      <th style={{ width: '90px' }}>금액</th>
                      <th style={{ width: '95px' }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDailyOrders.map((order, idx) => {
                      const dateObj = new Date(order.created_at);
                      // 정산 화면은 이미 선택된 하루(일자) 기준으로 보고 있으므로, 날짜는 빼고 시간만 표시한다.
                      const formattedTime = !isNaN(dateObj.getTime())
                        ? `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`
                        : order.created_at;

                      return (
                        <tr
                          key={order.id}
                          draggable
                          onDragStart={() => setDraggedOrderIdx(idx)}
                          onDragOver={handleDragOverItem('dailyOrders', idx)}
                          onDragLeave={clearDragIndicator}
                          onDragEnd={clearDragIndicator}
                          onDrop={() => handleGenericDrop(dailyOrders, setDailyOrders, draggedOrderIdx, idx)}
                          style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'center', height: '48px', background: '#fff', ...getDropLineStyle('dailyOrders', idx) }}
                        >
                          <td style={{ color: '#94a3b8' }}>☰</td>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{formattedTime}</td>
                          <td>
                            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                              {order.payment_type || '카드'}
                            </span>
                          </td>
                          <td>
                            <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                              {order.order_types?.name || '매장'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'left', paddingLeft: '10px', paddingRight: '10px', paddingTop: '8px', paddingBottom: '8px', fontSize: '12px', whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: '1.4' }}>
                            {order.order_items?.map(i => `${formatOrderItemLabel(i)}(${i.quantity})`).join(', ')}
                          </td>
                          <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{order.total_amount.toLocaleString()}원</td>
                          <td>
                            <button onClick={() => setEditingOrderModal({
                              ...order,
                              created_at: order.created_at ? order.created_at.split('T')[0] : getTodayStr(),
                            created_at_original: order.created_at,
                              order_items: order.order_items.map(item => ({
                                menu_id: item.menu_id,
                                name: item.menus?.name || '할인/기타',
                                price: item.price,
                                quantity: item.quantity,
                                isDiscount: item.menu_id === null || item.price < 0,
                                options: item.options || []
                              }))
                            })} style={{ marginRight: '4px', padding: '5px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>수정</button>
                            <button onClick={() => handleDeleteOrder(order.id)} style={{ padding: '5px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>삭제</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
              </div>
            </>
          )}

          {/* ===== 월단위 ===== */}
          {salesViewMode === 'monthly' && (
            <>
              <div style={{ width: '100%', background: '#fff', padding: '14px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '15px' }}>조회 월</h3>
                <select
                  value={selectedMonth}
                  onChange={e => { setSelectedMonth(e.target.value); setDrillDownDate(null); }}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#1e293b', boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  {availableMonths.length === 0 && <option value="">등록된 매출 월이 없습니다</option>}
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m} {m === getTodayStr().slice(0, 7) ? '(이번 달)' : ''}</option>
                  ))}
                </select>
              </div>

              <div style={{ width: '100%', background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}>
                <h2 style={{ marginTop: 0, marginBottom: '14px', fontSize: '16px' }}>{selectedMonth || '월 미선택'} 매출 상세</h2>

                {renderSalesFilterRow()}
                {renderSalesTotalCards(filteredRangeOrders)}

                <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>일자별 추이</h3>
                {renderTrendChart(monthlyChartData, {
                  clickable: true,
                  selectedKey: drillDownDate,
                  onSelect: (key) => setDrillDownDate(prev => (prev === key ? null : key))
                })}

                {drillDownDate && (
                  <div style={{ marginTop: '18px', borderTop: '2px solid #f1f5f9', paddingTop: '14px' }}>
                    <h3 style={{ fontSize: '14px', marginTop: 0, marginBottom: '10px' }}>{drillDownDate} 주문 목록 <span style={{ fontWeight: 'normal', fontSize: '11px', color: '#94a3b8' }}>(조회 전용 - 수정/삭제는 일단위 화면에서 해주세요)</span></h3>
                    {renderReadOnlyOrderList(drillDownOrders)}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== 연단위 ===== */}
          {salesViewMode === 'yearly' && (
            <>
              <div style={{ width: '100%', background: '#fff', padding: '14px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '15px' }}>조회 연도</h3>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#1e293b', boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  {availableYears.length === 0 && <option value="">등록된 매출 연도가 없습니다</option>}
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}년 {y === getTodayStr().slice(0, 4) ? '(올해)' : ''}</option>
                  ))}
                </select>
              </div>

              <div style={{ width: '100%', background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}>
                <h2 style={{ marginTop: 0, marginBottom: '14px', fontSize: '16px' }}>{selectedYear ? `${selectedYear}년` : '연도 미선택'} 매출 상세</h2>

                {renderSalesFilterRow()}
                {renderSalesTotalCards(filteredRangeOrders)}

                <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>월별 추이</h3>
                {renderTrendChart(yearlyChartData)}
              </div>
            </>
          )}

        </div>
      )}

      {/* 3. 메뉴 관리 탭 */}
      {activeTab === 'menuMgmt' && (
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '16px' }}>메뉴 세팅 및 관리</h2>
            <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
              <button onClick={() => setIsCategoryModalOpen(true)} style={{ flex: isMobile ? 1 : 'initial', padding: '8px 14px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                🏷️ 카테고리 관리
              </button>
              <button onClick={() => setIsOptionGroupModalOpen(true)} style={{ flex: isMobile ? 1 : 'initial', padding: '8px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                🧩 옵션 관리
              </button>
              <button onClick={() => { setNewMenu({ name: '', price: '', store_tag: selectedMgmtStore || '', category_id: '', option_group_ids: [] }); setIsCreateModalOpen(true); }} style={{ flex: isMobile ? 1 : 'initial', padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                + 메뉴 등록
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {storeTags.map(st => (
              <button key={st.id} onClick={() => setSelectedMgmtStore(st.name)} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: selectedMgmtStore === st.name ? '#2563eb' : '#f1f5f9', color: selectedMgmtStore === st.name ? '#fff' : '#64748b', fontWeight: 'bold', fontSize: '13px' }}>{st.name}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', paddingBottom: '6px', whiteSpace: isMobile ? 'nowrap' : 'normal' }}>
            <button
              onClick={() => setSelectedMgmtCategory('전체')}
              style={{
                padding: '6px 12px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                background: selectedMgmtCategory === '전체' ? '#0f172a' : '#f1f5f9',
                color: selectedMgmtCategory === '전체' ? '#fff' : '#64748b',
                fontWeight: 'bold',
                fontSize: '12px',
                flexShrink: 0
              }}
            >
              전체
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedMgmtCategory(cat.name)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedMgmtCategory === cat.name ? '#0f172a' : '#f1f5f9',
                  color: selectedMgmtCategory === cat.name ? '#fff' : '#64748b',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  flexShrink: 0
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '560px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', height: '40px', color: '#64748b' }}>
                  <th style={{ width: '30px' }}></th>
                  <th>가게</th><th>카테고리</th><th>메뉴명</th><th>가격</th><th style={{ width: '80px' }}>부가옵션</th><th style={{ width: '130px' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {menus.filter(m => {
                  const storeMatch = !selectedMgmtStore || m.store_tag === selectedMgmtStore;
                  const menuCatName = m.categories?.name || '카테고리 없음';
                  const catMatch = selectedMgmtCategory === '전체' || menuCatName === selectedMgmtCategory;
                  return storeMatch && catMatch;
                }).map((m, idx) => (
                  <tr
                    key={m.id}
                    draggable
                    onDragStart={() => setDraggedMenuIdx(idx)}
                    onDragOver={handleDragOverItem('menus', idx)}
                    onDragLeave={clearDragIndicator}
                    onDragEnd={clearDragIndicator}
                    onDrop={() => handleGenericDrop(menus, setMenus, draggedMenuIdx, idx)}
                    style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'center', height: '48px', ...getDropLineStyle('menus', idx) }}
                  >
                    <td style={{ color: '#94a3b8' }}>☰</td>
                    <td><span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{m.store_tag || '미지정'}</span></td>
                    <td><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{m.categories?.name || '없음'}</span></td>
                    <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{m.name}</td>
                    <td style={{ fontSize: '12px' }}>{m.price.toLocaleString()}원</td>
                    <td style={{ fontSize: '11px', color: (m.options || []).length > 0 ? '#2563eb' : '#94a3b8', fontWeight: 'bold' }}>
                      {(m.options || []).length > 0 ? `${m.options.length}개` : '없음'}
                    </td>
                    <td>
                      <button onClick={() => {
                        const initialCatId = m.categories?.id || m.category_id || '';
                        const initialOptionGroupIds = (m.options || []).map(g => g.id);
                        setEditingMenuModal({ ...m, category_id: initialCatId, option_group_ids: initialOptionGroupIds });
                        if (m.store_tag) {
                          fetchModalCategories(m.store_tag);
                          fetchModalOptionGroups(m.store_tag);
                        }
                      }} style={{ marginRight: '4px', padding: '5px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>수정</button>
                      <button onClick={() => handleDeleteMenu(m.id)} style={{ padding: '5px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* [개선 4 반영] 4. 가게/배달 관리 탭 - 화면이 넓을 때 좌우 2단 컬럼 구조로 배치 */}
      {activeTab === 'categoryMgmt' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px', boxSizing: 'border-box', width: '100%', alignItems: 'start' }}>

          <div style={{ width: '100%', background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>가게 구분 관리</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input placeholder="예: 3호점, 강남점" value={newStoreInput} onChange={e => setNewStoreInput(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              <button onClick={handleAddStoreTag} style={{ padding: '10px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>추가</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {storeTags.map((st, idx) => (
                <div
                  key={st.id}
                  draggable
                  onDragStart={() => setDraggedStoreIdx(idx)}
                  onDragOver={handleDragOverItem('storeTags', idx)}
                  onDragLeave={clearDragIndicator}
                  onDragEnd={clearDragIndicator}
                  onDrop={() => handleStoreTagDrop(draggedStoreIdx, idx)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', ...getDropLineStyle('storeTags', idx) }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ color: '#94a3b8' }}>☰</span><span style={{ fontWeight: 'bold', fontSize: '13px' }}>{st.name}</span></div>
                  <button onClick={() => handleDeleteStoreTag(st.id)} style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>삭제</button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>배달 구분 관리</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input placeholder="예: 배달의민족, 쿠팡이츠" value={newOrderTypeInput} onChange={e => setNewOrderTypeInput(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              <button onClick={handleAddOrderType} style={{ padding: '10px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>추가</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {orderTypes.map((ot, idx) => (
                <div
                  key={ot.id}
                  draggable
                  onDragStart={() => setDraggedOrderTypeIdx(idx)}
                  onDragOver={handleDragOverItem('orderTypes', idx)}
                  onDragLeave={clearDragIndicator}
                  onDragEnd={clearDragIndicator}
                  onDrop={() => handleOrderTypeDrop(draggedOrderTypeIdx, idx)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', ...getDropLineStyle('orderTypes', idx) }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ color: '#94a3b8' }}>☰</span><span style={{ fontWeight: 'bold', fontSize: '13px' }}>{ot.name}</span></div>
                  <button onClick={() => handleDeleteOrderType(ot.id)} style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>삭제</button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* 부가옵션 선택 팝업 (POS 메뉴 선택 화면에서 옵션이 있는 메뉴를 클릭했을 때) */}
      {expandedMenuOptions && (() => {
        const menu = menus.find(m => m.id === expandedMenuOptions.menuId);
        if (!menu) return null;
        const groups = menu.options || [];
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, boxSizing: 'border-box', padding: '16px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{menu.name}</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>기본가 {menu.price.toLocaleString()}원</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0, marginBottom: '16px' }}>옵션을 선택해주세요.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '18px' }}>
                {groups.map(group => (
                  <div key={group.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{group.name}</span>
                      {group.is_required && <span style={{ fontSize: '10px', color: '#fff', background: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>필수</span>}
                      {group.allow_multiple && <span style={{ fontSize: '10px', color: '#3730a3', background: '#e0e7ff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>중복선택가능</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(group.options || []).map(opt => {
                        const sel = expandedMenuOptions.selections[group.id];
                        const isSelected = group.allow_multiple ? (Array.isArray(sel) && sel.includes(opt.id)) : sel === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => toggleOptionSelection(group, opt.id)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '9px 12px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              background: isSelected ? '#dbeafe' : '#fff'
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: isSelected ? '#1d4ed8' : '#334155' }}>{opt.name}</span>
                            <span style={{ fontSize: '12px', color: opt.extra_price > 0 ? '#2563eb' : '#94a3b8' }}>
                              {opt.extra_price > 0 ? `+${opt.extra_price.toLocaleString()}원` : '추가금액 없음'}
                            </span>
                          </button>
                        );
                      })}
                      {(group.options || []).length === 0 && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', padding: '6px' }}>등록된 옵션이 없습니다.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setExpandedMenuOptions(null)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>취소</button>
                <button onClick={confirmOptionSelection} style={{ flex: 2, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>장바구니 담기</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 카테고리 관리 팝업 */}
      {isCategoryModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, boxSizing: 'border-box', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '380px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '16px' }}>🏷️ 메뉴 카테고리 관리</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
              현재 선택된 가게: <strong style={{ color: '#2563eb' }}>{selectedMgmtStore}</strong>
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input placeholder="예: 메인요리, 사이드, 음료" value={newCategoryInput} onChange={e => setNewCategoryInput(e.target.value)} style={{ flex: 1, padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
              <button onClick={handleAddCategory} style={{ padding: '9px 14px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>추가</button>
            </div>
            {/* 카테고리 수가 많아져도 입력창/닫기 버튼은 항상 보이도록, 목록만 정해진 높이 안에서 스크롤되게 한다 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '320px', overflowY: 'auto', paddingRight: '2px' }}>
              {categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  draggable={editingCategoryId !== cat.id}
                  onDragStart={() => setDraggedCategoryIdx(idx)}
                  onDragOver={handleDragOverItem('categories', idx)}
                  onDragLeave={clearDragIndicator}
                  onDragEnd={clearDragIndicator}
                  onDrop={() => handleCategoryDrop(draggedCategoryIdx, idx)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', ...getDropLineStyle('categories', idx) }}
                >
                  {editingCategoryId === cat.id ? (
                    <>
                      <input
                        autoFocus
                        value={editingCategoryName}
                        onChange={e => setEditingCategoryName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(); if (e.key === 'Escape') cancelEditCategory(); }}
                        style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid #2563eb', fontSize: '12px', marginRight: '8px' }}
                      />
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={handleRenameCategory} style={{ padding: '4px 8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>저장</button>
                        <button onClick={cancelEditCategory} style={{ padding: '4px 8px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>취소</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#94a3b8' }}>☰</span><span style={{ fontWeight: 'bold', fontSize: '12px' }}>{cat.name}</span></div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => startEditCategory(cat)} style={{ padding: '4px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>수정</button>
                        <button onClick={() => handleDeleteCategory(cat.id)} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>삭제</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => { setIsCategoryModalOpen(false); cancelEditCategory(); }} style={{ width: '100%', padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>닫기</button>
          </div>
        </div>
      )}

      {/* 부가옵션 관리 모달 (메뉴 관리 탭 - "옵션 관리" 버튼, 가게 하위 공통 리소스) */}
      {isOptionGroupModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, boxSizing: 'border-box', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: isMobile ? '460px' : '760px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', fontSize: '16px' }}>🧩 부가옵션 관리</h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              현재 선택된 가게: <strong style={{ color: '#2563eb' }}>{selectedMgmtStore}</strong> · 여기서 만든 옵션 그룹은 메뉴 등록/수정 시 선택해서 붙일 수 있습니다.
            </p>

            {optionGroups.length === 0 && (
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px', textAlign: 'center', padding: '14px', background: '#f8fafc', borderRadius: '8px' }}>
                등록된 옵션 그룹이 없습니다. 아래에서 새 옵션 그룹을 추가해주세요.<br />
                (예: "곱빼기 선택" - 기본/곱빼기, "면 종류 선택" - 칼국수/수제비/칼제비)
              </div>
            )}

            {isMobile ? (
              <>
                {/* 모바일: 기존처럼 그룹마다 카드를 세로로 쌓고, 목록만 스크롤되게 해서 입력창/닫기 버튼은 항상 보이게 한다 */}
                <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '2px' }}>
                  {optionGroups.map(group => (
                    <div key={group.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '12px', background: '#f8fafc' }}>
                      {renderOptionGroupDetail(group)}
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '12px', marginTop: '4px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px' }}>+ 새 옵션 그룹 추가</p>
                  {renderAddOptionGroupForm()}
                </div>
              </>
            ) : (
              <>
                {/* PC: 최상단에 그룹 추가 버튼(누르면 폼이 펼쳐짐), 하단은 좌(그룹명 목록)/우(선택한 그룹 상세)로 분할 */}
                <div style={{ marginBottom: '14px' }}>
                  <button
                    onClick={() => setIsDesktopAddGroupOpen(v => !v)}
                    style={{ padding: '9px 16px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    {isDesktopAddGroupOpen ? '− 새 옵션 그룹 추가 닫기' : '+ 새 옵션 그룹 추가'}
                  </button>
                  {isDesktopAddGroupOpen && (
                    <div style={{ marginTop: '10px', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      {renderAddOptionGroupForm()}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '14px', height: '440px' }}>
                  <div style={{ width: '220px', flexShrink: 0, overflowY: 'auto', borderRight: '1px solid #f1f5f9', paddingRight: '10px' }}>
                    {optionGroups.map(group => (
                      <button
                        key={group.id}
                        onClick={() => setSelectedOptionGroupIdForModal(group.id)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left',
                          padding: '10px 12px', marginBottom: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                          background: selectedOptionGroupIdForModal === group.id ? '#eff6ff' : 'transparent',
                          color: selectedOptionGroupIdForModal === group.id ? '#1d4ed8' : '#334155',
                          fontWeight: selectedOptionGroupIdForModal === group.id ? 'bold' : 'normal',
                          fontSize: '13px'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0, marginLeft: '6px' }}>{(group.option_items || []).length}개</span>
                      </button>
                    ))}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '2px' }}>
                    {(() => {
                      const selectedGroup = optionGroups.find(g => g.id === selectedOptionGroupIdForModal);
                      return selectedGroup
                        ? renderOptionGroupDetail(selectedGroup)
                        : <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '24px' }}>왼쪽에서 옵션 그룹을 선택해주세요.</div>;
                    })()}
                  </div>
                </div>
              </>
            )}

            <button onClick={() => { setIsOptionGroupModalOpen(false); cancelEditOptionGroup(); cancelEditOptionItem(); setIsDesktopAddGroupOpen(false); }} style={{ width: '100%', padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', marginTop: '14px' }}>닫기</button>
          </div>
        </div>
      )}

      {/* POS용 할인 모달 */}
      {isDiscountModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, boxSizing: 'border-box', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '320px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0, marginBottom: '14px', fontSize: '16px' }}>🏷️ 금액 할인 추가</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>할인 명칭</label>
              <input type="text" value={discountName} onChange={e => setDiscountName(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>할인 금액 (원)</label>
              <input type="number" placeholder="예: 2000" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsDiscountModalOpen(false)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>취소</button>
              <button onClick={addDiscountToCart} style={{ flex: 1, padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 주문 수정용 할인 모달 */}
      {isEditDiscountModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1001, boxSizing: 'border-box', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '320px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0, marginBottom: '14px', fontSize: '16px' }}>🏷️ 주문 수정 - 금액 할인 추가</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>할인 명칭</label>
              <input type="text" value={editDiscountName} onChange={e => setEditDiscountName(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>할인 금액 (원)</label>
              <input type="number" placeholder="예: 2000" value={editDiscountAmount} onChange={e => setEditDiscountAmount(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsEditDiscountModalOpen(false)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>취소</button>
              <button onClick={() => {
                const amt = Number(editDiscountAmount);
                if (!amt || amt <= 0) return alert('유효한 할인 금액을 입력해주세요.');
                setEditingOrderModal(prev => ({
                  ...prev,
                  order_items: [...prev.order_items, { menu_id: 0, name: editDiscountName || '금액 할인', price: -amt, quantity: 1, isDiscount: true, options: [] }]
                }));
                setEditDiscountAmount('');
                setIsEditDiscountModalOpen(false);
              }} style={{ flex: 1, padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 주문 상세 수정 모달 */}
      {editingOrderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, boxSizing: 'border-box', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>✏️ 주문 상세 수정</h3>
              <button onClick={() => setIsEditDiscountModalOpen(true)} style={{ padding: '6px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                🏷️ 금액 할인 추가
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', width: '100px', flexShrink: 0 }}>저장 일자</label>
              <input type="date" value={editingOrderModal.created_at} onChange={e => setEditingOrderModal({ ...editingOrderModal, created_at: e.target.value })} style={{ flex: 1, padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', width: '100px', flexShrink: 0, paddingTop: '6px' }}>주문 / 배달 구분</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                {orderTypes.map(ot => (
                  <button
                    key={ot.id}
                    onClick={() => setEditingOrderModal({ ...editingOrderModal, order_type_id: ot.id })}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '14px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
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

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', gap: '12px' }}>
              <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', width: '100px', flexShrink: 0 }}>결제 구분</label>
              <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                {['카드', '현금'].map(pt => (
                  <button
                    key={pt}
                    onClick={() => setEditingOrderModal({ ...editingOrderModal, payment_type: pt })}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '14px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
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

            <div style={{ marginBottom: '16px', overflowX: 'auto' }}>
              <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>주문 상품 목록</label>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '320px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', textAlign: 'left', height: '32px' }}>
                    <th style={{ width: '40%' }}>상품명 / 할인</th><th style={{ width: '25%' }}>수량</th><th style={{ width: '25%', textAlign: 'right' }}>금액</th><th style={{ width: '10%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editingOrderModal.order_items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc', color: item.isDiscount ? '#dc2626' : '#333' }}>
                      <td style={{ fontWeight: 'bold', fontSize: '12px', verticalAlign: 'top', paddingTop: '8px', paddingBottom: '8px' }}>
                        <div>{item.name}</div>
                        {(item.options || []).map((o, i) => (
                          <div key={i} style={{ fontSize: '10px', fontWeight: 'normal', color: '#64748b', paddingLeft: '10px', marginTop: '2px' }}>
                            – {o.option_name}{o.extra_price > 0 ? ` (+${o.extra_price.toLocaleString()}원)` : ''}
                          </div>
                        ))}
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: '8px' }}>
                        {!item.isDiscount ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <button onClick={() => {
                              setEditingOrderModal(prev => ({
                                ...prev,
                                order_items: prev.order_items.map((it, i) => i === idx && it.quantity > 1 ? { ...it, quantity: it.quantity - 1 } : it)
                              }));
                            }} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>-</button>
                            <span style={{ fontWeight: 'bold', fontSize: '12px', minWidth: '14px', textAlign: 'center' }}>{item.quantity}</span>
                            <button onClick={() => {
                              setEditingOrderModal(prev => ({
                                ...prev,
                                order_items: prev.order_items.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it)
                              }));
                            }} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer' }}>+</button>
                          </div>
                        ) : (
                          <span>1</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '12px', verticalAlign: 'top', paddingTop: '8px' }}>{(item.price * item.quantity).toLocaleString()}원</td>
                      <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '8px' }}>
                        <button onClick={() => {
                          setEditingOrderModal(prev => ({
                            ...prev,
                            order_items: prev.order_items.filter((_, i) => i !== idx)
                          }));
                        }} style={{ padding: '3px 6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>X</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderTop: '2px solid #f1f5f9', paddingTop: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>수정된 총 금액</span>
              <span style={{ fontSize: '17px', fontWeight: 'bold', color: '#2563eb' }}>
                {editingOrderModal.order_items.reduce((s, i) => s + i.price * i.quantity, 0).toLocaleString()}원
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditingOrderModal(null)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>취소</button>
              <button onClick={handleUpdateOrderSubmit} style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 새 메뉴 등록 모달 */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, boxSizing: 'border-box', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '340px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0, marginBottom: '14px', fontSize: '16px' }}>새 메뉴 등록</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>가게 구분</label>
              <select value={newMenu.store_tag} onChange={e => setNewMenu({ ...newMenu, store_tag: e.target.value, category_id: '' })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }}>
                <option value="">선택해주세요</option>
                {storeTags.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>카테고리</label>
              <select value={newMenu.category_id} onChange={e => setNewMenu({ ...newMenu, category_id: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }}>
                <option value="">카테고리 없음</option>
                {modalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>메뉴명</label>
              <input placeholder="예: 소고기죽" value={newMenu.name} onChange={e => setNewMenu({ ...newMenu, name: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>가격</label>
              <input type="number" placeholder="예: 10000" value={newMenu.price} onChange={e => setNewMenu({ ...newMenu, price: Number(e.target.value) })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>부가옵션</label>
              {!newMenu.store_tag ? (
                <div style={{ fontSize: '11px', color: '#94a3b8', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>가게를 먼저 선택해주세요.</div>
              ) : modalOptionGroups.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#94a3b8', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>
                  이 가게에 등록된 옵션 그룹이 없습니다. (메뉴 관리 화면의 "옵션 관리"에서 먼저 만들어주세요)
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px' }}>
                  {modalOptionGroups.map(group => {
                    const checked = (newMenu.option_group_ids || []).includes(group.id);
                    return (
                      <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setNewMenu(prev => {
                            const current = prev.option_group_ids || [];
                            const next = checked ? current.filter(id => id !== group.id) : [...current, group.id];
                            return { ...prev, option_group_ids: next };
                          })}
                        />
                        <span style={{ fontWeight: 'bold' }}>{group.name}</span>
                        <span style={{ color: '#94a3b8' }}>({(group.option_items || []).length}개 옵션{group.is_required ? ' · 필수' : ''})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>취소</button>
              <button onClick={handleCreateMenu} style={{ flex: 1, padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>등록</button>
            </div>
          </div>
        </div>
      )}

      {/* 메뉴 수정 모달 */}
      {editingMenuModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, boxSizing: 'border-box', padding: '16px' }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', width: '100%', maxWidth: '340px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}>
            <h3 style={{ marginTop: 0, marginBottom: '14px', fontSize: '16px' }}>메뉴 수정</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>가게 구분</label>
              <select value={editingMenuModal.store_tag} onChange={e => setEditingMenuModal({ ...editingMenuModal, store_tag: e.target.value, category_id: '' })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }}>
                <option value="">선택해주세요</option>
                {storeTags.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>카테고리</label>
              <select value={editingMenuModal.category_id} onChange={e => setEditingMenuModal({ ...editingMenuModal, category_id: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }}>
                <option value="">카테고리 없음</option>
                {modalCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '12px', width: '100%' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>메뉴명</label>
              <input value={editingMenuModal.name} onChange={e => setEditingMenuModal({ ...editingMenuModal, name: e.target.value })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>가격</label>
              <input type="number" value={editingMenuModal.price} onChange={e => setEditingMenuModal({ ...editingMenuModal, price: Number(e.target.value) })} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '12px' }} />
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '6px' }}>부가옵션</label>
              {!editingMenuModal.store_tag ? (
                <div style={{ fontSize: '11px', color: '#94a3b8', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>가게를 먼저 선택해주세요.</div>
              ) : modalOptionGroups.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#94a3b8', padding: '8px', background: '#f8fafc', borderRadius: '6px' }}>
                  이 가게에 등록된 옵션 그룹이 없습니다. (메뉴 관리 화면의 "옵션 관리"에서 먼저 만들어주세요)
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px' }}>
                  {modalOptionGroups.map(group => {
                    const checked = (editingMenuModal.option_group_ids || []).includes(group.id);
                    return (
                      <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setEditingMenuModal(prev => {
                            const current = prev.option_group_ids || [];
                            const next = checked ? current.filter(id => id !== group.id) : [...current, group.id];
                            return { ...prev, option_group_ids: next };
                          })}
                        />
                        <span style={{ fontWeight: 'bold' }}>{group.name}</span>
                        <span style={{ color: '#94a3b8' }}>({(group.option_items || []).length}개 옵션{group.is_required ? ' · 필수' : ''})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditingMenuModal(null)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>취소</button>
              <button onClick={handleUpdateMenuModal} style={{ flex: 1, padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>수정</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
