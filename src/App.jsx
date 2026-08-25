const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('POS Backend Server is Running!');
});

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// [1] 메뉴 관련 API
// ==========================================
app.get('/api/menus', async (req, res) => {
  const { store_tag, store_tag_id } = req.query;
  try {
    // 부가옵션(옵션 그룹/옵션)은 가게(store_tag) 하위에 공통으로 존재하는 option_groups/option_items를
    // menu_option_links로 메뉴에 연결하는 구조다. 메뉴 조회 시 연결된 그룹/옵션까지 함께 가져온다.
    let query = supabase
      .from('menus')
      .select(`
        *,
        categories (
          id,
          name,
          store_tag
        ),
        menu_option_links (
          option_groups (
            id,
            name,
            is_required,
            allow_multiple,
            display_order,
            option_items ( id, name, extra_price, display_order )
          )
        )
      `);

    // 가게 구분 필터 (문자열 혹은 ID 조건이 들어올 경우 정확히 매칭)
    if (store_tag && store_tag !== '전체') {
      query = query.eq('store_tag', store_tag.trim());
    }
    if (store_tag_id) {
      query = query.eq('store_tag_id', Number(store_tag_id));
    }

    const { data, error } = await query;

    if (error) {
      console.error('메뉴 목록 조회 에러:', error);
      return res.status(500).json({ error: error.message });
    }

    // 선택된 가게와 카테고리의 가게 태그가 일치하는지 한 번 더 검증하여 섞임 방지
    const filteredData = data.filter(menu => {
      if (!store_tag || store_tag === '전체') return true;
      if (menu.store_tag && menu.store_tag.trim() !== store_tag.trim()) return false;
      return true;
    });

    const formattedMenus = filteredData.map(menu => {
      // menu_option_links -> option_groups 로 중첩된 구조를 평탄화하고, 프론트에서 쓰기 쉽도록
      // 그룹의 option_items를 options 라는 이름으로 다시 노출한다.
      const groups = (menu.menu_option_links || [])
        .map(link => link.option_groups)
        .filter(Boolean)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map(group => ({
          id: group.id,
          name: group.name,
          is_required: group.is_required,
          allow_multiple: group.allow_multiple,
          options: (group.option_items || [])
            .slice()
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        }));

      const { menu_option_links, ...rest } = menu;
      return {
        ...rest,
        category: menu.categories ? menu.categories.name : (menu.category || '카테고리 없음'),
        options: groups
      };
    });

    // 메뉴 관리 화면의 드래그 순서변경(display_order)이 새로고침 후에도 유지되도록 정렬해서 내려준다.
    // display_order가 아직 없는(기존) 메뉴는 0으로 취급되어 뒤섞이지 않고 그대로 앞쪽에 남는다.
    formattedMenus.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    res.json(formattedMenus);
  } catch (err) {
    console.error('메뉴 목록 조회 서버 예외:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 메뉴 <-> 옵션그룹 연결을 menu_option_links 테이블에 다시 세팅한다 (기존 연결 삭제 후 재삽입).
const syncMenuOptionLinks = async (menuId, optionGroupIds) => {
  const groupIds = Array.isArray(optionGroupIds)
    ? optionGroupIds.map(id => Number(id)).filter(id => !Number.isNaN(id))
    : [];

  const { error: deleteError } = await supabase.from('menu_option_links').delete().eq('menu_id', menuId);
  if (deleteError) throw deleteError;

  if (groupIds.length > 0) {
    const links = groupIds.map(groupId => ({ menu_id: menuId, group_id: groupId }));
    const { error: insertError } = await supabase.from('menu_option_links').insert(links);
    if (insertError) throw insertError;
  }
};

app.post('/api/menus', async (req, res) => {
  const { name, price, store_tag_id, store_tag, category_id, category, option_group_ids } = req.body;
  try {
    let categoryName = null;
    let resolvedStoreTag = store_tag ? store_tag.trim() : null;
    const parsedCategoryId = category_id === '' || category_id === null || category_id === undefined ? null : Number(category_id);

    if (parsedCategoryId) {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('name, store_tag')
        .eq('id', parsedCategoryId)
        .single();

      if (!catError && catData) {
        categoryName = catData.name;
        if (catData.store_tag) {
          resolvedStoreTag = catData.store_tag.trim();
        }
      }
    }

    const { data, error } = await supabase
      .from('menus')
      .insert([{
        name,
        price,
        store_tag_id: store_tag_id ? Number(store_tag_id) : null,
        store_tag: resolvedStoreTag,
        category_id: parsedCategoryId,
        category: categoryName || category || null
      }])
      .select();

    if (error) throw error;

    const newMenu = data && data[0];
    if (newMenu) {
      await syncMenuOptionLinks(newMenu.id, option_group_ids);
    }

    res.json(data);
  } catch (err) {
    console.error('메뉴 등록 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 메뉴 순서 변경 (카테고리/가게구분과 동일한 방식). 반드시 '/api/menus/:id' 보다 먼저 등록해야
// Express가 "order"를 :id 값으로 잘못 매칭하는 라우팅 충돌을 피할 수 있다.
app.put('/api/menus/order', async (req, res) => {
  try {
    const menuList = Array.isArray(req.body) ? req.body : (req.body.items || req.body.order);
    if (!Array.isArray(menuList)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < menuList.length; i++) {
      const m = menuList[i];
      if (!m.id) continue;
      const displayOrder = m.display_order !== undefined ? m.display_order : i;
      const { error } = await supabase.from('menus').update({ display_order: displayOrder }).eq('id', m.id);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('메뉴 순서 변경 에러:', err.message);
    // Postgres의 "컬럼 없음" 에러(42703)는 menus 테이블에 display_order 컬럼이 아직 없는 경우다.
    // 이 경우 원인을 바로 알 수 있도록 안내 메시지를 붙여서 내려준다.
    const isMissingColumn = err.code === '42703' || /display_order.*does not exist/i.test(err.message || '');
    if (isMissingColumn) {
      return res.status(500).json({ error: 'menus 테이블에 display_order 컬럼이 없어서 순서를 저장할 수 없습니다. Supabase Table Editor에서 menus 테이블에 display_order(정수, 기본값 0) 컬럼을 추가한 뒤 다시 시도해주세요.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menus/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, store_tag_id, store_tag, category_id, option_group_ids } = req.body;

  try {
    let categoryName = null;
    let resolvedStoreTag = store_tag ? store_tag.trim() : null;
    const parsedCategoryId = category_id === '' || category_id === null || category_id === undefined ? null : Number(category_id);

    if (parsedCategoryId) {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('name, store_tag')
        .eq('id', parsedCategoryId)
        .single();

      if (!catError && catData) {
        categoryName = catData.name;
        if (catData.store_tag) {
          resolvedStoreTag = catData.store_tag.trim();
        }
      }
    }

    const updateData = {
      name,
      price,
      store_tag_id: store_tag_id ? Number(store_tag_id) : null,
      store_tag: resolvedStoreTag,
      category_id: parsedCategoryId,
      category: categoryName
    };

    const { data, error } = await supabase
      .from('menus')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase menus update 에러:', error);
      return res.status(500).json({ error: error.message });
    }

    if (option_group_ids !== undefined) {
      await syncMenuOptionLinks(Number(id), option_group_ids);
    }

    res.json(data);
  } catch (err) {
    console.error('menus 수정 서버 예외:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menus/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('menus').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [1-1] 메뉴 카테고리 관리 API
// ==========================================
app.get('/api/categories', async (req, res) => {
  const { store_tag } = req.query;
  try {
    let query = supabase.from('categories').select('*').order('display_order', { ascending: true });

    if (store_tag && store_tag !== '전체') {
      query = query.eq('store_tag', store_tag.trim());
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase categories 조회 경고:', error.message);
      return res.json([]);
    }
    res.json(data || []);
  } catch (err) {
    console.error('categories API 서버 예외:', err.message);
    res.json([]);
  }
});

app.post('/api/categories', async (req, res) => {
  const { name, store_tag } = req.body;
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, store_tag: store_tag ? store_tag.trim() : null, display_order: 0 }])
      .select();

    if (error) {
      console.error('Supabase categories insert 에러:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('categories 등록 서버 예외:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/categories/order', async (req, res) => {
  try {
    const categories = Array.isArray(req.body)
      ? req.body
      : (req.body.items || req.body.categories || req.body.order);

    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const catId = cat.id;
      const displayOrder = cat.display_order !== undefined ? cat.display_order : (cat.sort_order !== undefined ? cat.sort_order : i);

      if (!catId) continue;

      const { error } = await supabase
        .from('categories')
        .update({ display_order: displayOrder })
        .eq('id', catId);

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('카테고리 순서 변경 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 카테고리명 수정 (※ '/api/categories/order' 라우트보다 반드시 아래에 있어야 한다 -
//   그렇지 않으면 :id 파라미터가 "order"라는 문자열을 가로채서 순서 변경 API가 깨진다)
app.put('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '카테고리명을 입력해주세요.' });

  try {
    const { data, error } = await supabase
      .from('categories')
      .update({ name: name.trim() })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('카테고리 수정 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: catData } = await supabase.from('categories').select('name').eq('id', id).single();
    if (catData) {
      await supabase.from('menus').update({ category: null, category_id: null }).eq('category', catData.name);
    }
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('categories 삭제 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [1-2] 부가옵션(옵션 그룹 / 옵션) 관리 API
//  카테고리와 마찬가지로 "가게(store_tag)" 하위에 공통으로 귀속되는 리소스다.
//  option_groups(가게별 옵션 그룹) - option_items(그룹별 옵션 항목) - menu_option_links(메뉴↔그룹 연결)
//  예) "죽풍경" 가게에 "곱빼기 선택"(기본/곱빼기), "면 종류 선택"(칼국수/수제비/칼제비) 그룹을 만들어두면
//      메뉴 등록/수정 시 이 그룹들 중 필요한 것을 골라서 연결하는 방식.
// ==========================================

// 가게별 옵션 그룹 목록 조회 (각 그룹의 옵션 항목까지 함께)
app.get('/api/option-groups', async (req, res) => {
  const { store_tag } = req.query;
  try {
    let query = supabase
      .from('option_groups')
      .select(`*, option_items ( id, name, extra_price, base_extra_price, display_order )`)
      .order('display_order', { ascending: true });

    if (store_tag && store_tag !== '전체') {
      query = query.eq('store_tag', store_tag.trim());
    }

    const { data, error } = await query;
    if (error) throw error;

    const formatted = (data || []).map(group => ({
      ...group,
      option_items: (group.option_items || []).slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    }));

    res.json(formatted);
  } catch (err) {
    console.error('옵션 그룹 조회 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션 그룹 추가 (가게 하위)
app.post('/api/option-groups', async (req, res) => {
  const { name, store_tag, is_required, allow_multiple } = req.body;
  if (!name) return res.status(400).json({ error: '옵션 그룹명을 입력해주세요.' });
  if (!store_tag) return res.status(400).json({ error: '옵션 그룹을 추가할 가게를 먼저 선택해주세요.' });

  try {
    const { count } = await supabase
      .from('option_groups')
      .select('id', { count: 'exact', head: true })
      .eq('store_tag', store_tag.trim());

    const { data, error } = await supabase
      .from('option_groups')
      .insert([{
        name,
        store_tag: store_tag.trim(),
        is_required: !!is_required,
        allow_multiple: !!allow_multiple,
        display_order: count || 0
      }])
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('옵션 그룹 추가 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션 그룹 순서 변경 (카테고리/가게구분과 동일한 방식). '/api/option-groups/:id' 보다 반드시 먼저 등록해서
// Express가 "order"를 :id 값으로 잘못 매칭하는 라우팅 충돌을 피한다 (menus/order와 동일한 이유).
app.put('/api/option-groups/order', async (req, res) => {
  try {
    const groups = Array.isArray(req.body) ? req.body : (req.body.items || req.body.order);
    if (!Array.isArray(groups)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (!g.id) continue;
      const displayOrder = g.display_order !== undefined ? g.display_order : i;
      const { error } = await supabase.from('option_groups').update({ display_order: displayOrder }).eq('id', g.id);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('옵션 그룹 순서 변경 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션 그룹 수정 (이름 / 필수 여부 / 다중 선택 허용 여부)
app.put('/api/option-groups/:id', async (req, res) => {
  const { id } = req.params;
  const { name, is_required, allow_multiple } = req.body;

  try {
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (is_required !== undefined) updateData.is_required = !!is_required;
    if (allow_multiple !== undefined) updateData.allow_multiple = !!allow_multiple;

    const { data, error } = await supabase.from('option_groups').update(updateData).eq('id', id).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('옵션 그룹 수정 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션 그룹 삭제 (하위 옵션 및 메뉴 연결도 함께 삭제됨 - FK CASCADE)
app.delete('/api/option-groups/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('option_groups').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('옵션 그룹 삭제 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션(부가옵션 항목) 추가 - 추가 비용 포함
app.post('/api/option-groups/:groupId/items', async (req, res) => {
  const { groupId } = req.params;
  const { name, extra_price } = req.body;
  if (!name) return res.status(400).json({ error: '옵션명을 입력해주세요.' });

  try {
    const { count } = await supabase
      .from('option_items')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', Number(groupId));

    const { data, error } = await supabase
      .from('option_items')
      .insert([{
        group_id: Number(groupId),
        name,
        extra_price: extra_price ? Number(extra_price) : 0,
        display_order: count || 0
      }])
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('옵션 추가 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션(부가옵션 항목) 순서 변경. '/api/option-items/:id' 보다 반드시 먼저 등록해야 한다.
app.put('/api/option-items/order', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : (req.body.items || req.body.order);
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.id) continue;
      const displayOrder = it.display_order !== undefined ? it.display_order : i;
      const { error } = await supabase.from('option_items').update({ display_order: displayOrder }).eq('id', it.id);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('옵션 순서 변경 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션(부가옵션 항목) 가격 일괄 조정 - 옵션 그룹 안의 옵션들 추가금액을 정액/정률로 한번에 가산·감산할 때 사용.
// 반올림/0원 미만 방지 등 계산은 프론트에서 끝내고, 여기서는 계산된 최종 extra_price만 그대로 저장한다.
// base_extra_price는 "조정 전 원래 금액"을 잠시 보관해두는 용도다. 적용할 때는 조정 전 금액을 여기 저장하고,
// 해제할 때는 이 값을 다시 extra_price로 되돌린 뒤 null로 비운다 (null이면 "지금 적용 중인 조정 없음"이라는 뜻).
// '/api/option-items/:id' 보다 반드시 먼저 등록해서 "bulk-price"가 :id로 잘못 매칭되는 것을 막는다 (order 엔드포인트와 동일한 이유).
app.put('/api/option-items/bulk-price', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : (req.body.items || req.body.order);
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.id) continue;
      const updateData = { extra_price: Number(it.extra_price) || 0 };
      if (Object.prototype.hasOwnProperty.call(it, 'base_extra_price')) {
        updateData.base_extra_price = (it.base_extra_price === null || it.base_extra_price === undefined) ? null : Number(it.base_extra_price);
      }
      const { error } = await supabase.from('option_items').update(updateData).eq('id', it.id);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('옵션 가격 일괄 조정 에러:', err.message);
    // Postgres의 "컬럼 없음" 에러(42703) - option_items 테이블에 base_extra_price 컬럼이 아직 없는 경우다.
    const isMissingColumn = err.code === '42703' || /base_extra_price.*does not exist/i.test(err.message || '');
    if (isMissingColumn) {
      return res.status(500).json({ error: 'option_items 테이블에 base_extra_price 컬럼이 없어서 임시 가격 조정을 적용/해제할 수 없습니다. Supabase Table Editor에서 option_items 테이블에 base_extra_price(정수, NULL 허용) 컬럼을 추가한 뒤 다시 시도해주세요.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 옵션(부가옵션 항목) 수정
app.put('/api/option-items/:id', async (req, res) => {
  const { id } = req.params;
  const { name, extra_price } = req.body;

  try {
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (extra_price !== undefined) updateData.extra_price = Number(extra_price);

    const { data, error } = await supabase.from('option_items').update(updateData).eq('id', id).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('옵션 수정 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 옵션(부가옵션 항목) 삭제
app.delete('/api/option-items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('option_items').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('옵션 삭제 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [2] 가게 구분 관리 API
// ==========================================
app.get('/api/store-tags', async (req, res) => {
  try {
    const { data, error } = await supabase.from('store_tags').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/store-tags', async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await supabase.from('store_tags').insert([{ name, display_order: 0 }]).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/store-tags/order', async (req, res) => {
  try {
    const items = Array.isArray(req.body)
      ? req.body
      : (req.body.items || req.body.store_tags || req.body.order);

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = item.id;
      const displayOrder = item.display_order !== undefined ? item.display_order : (item.sort_order !== undefined ? item.sort_order : i);

      if (!itemId) continue;

      const { error } = await supabase
        .from('store_tags')
        .update({ display_order: displayOrder })
        .eq('id', itemId);

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('가게 구분 순서 변경 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/store-tags/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('store_tags').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [3] 배달 구분 관리 API
// ==========================================
app.get('/api/order-types', async (req, res) => {
  try {
    const { data, error } = await supabase.from('order_types').select('*').order('display_order', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/order-types', async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await supabase.from('order_types').insert([{ name, display_order: 0 }]).select();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/order-types/order', async (req, res) => {
  try {
    const items = Array.isArray(req.body)
      ? req.body
      : (req.body.items || req.body.order_types || req.body.order);

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '올바른 형식의 데이터가 아닙니다.', received: req.body });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = item.id;
      const displayOrder = item.display_order !== undefined ? item.display_order : (item.sort_order !== undefined ? item.sort_order : i);

      if (!itemId) continue;

      const { error } = await supabase
        .from('order_types')
        .update({ display_order: displayOrder })
        .eq('id', itemId);

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('배달 구분 순서 변경 에러:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/order-types/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('order_types').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [4] 주문 및 일매출 정산 API
// ==========================================
app.post('/api/orders', async (req, res) => {
  let { store_id, order_type_id, payment_type, total_amount, items, created_at } = req.body;

  try {
    const { data: orderTypes } = await supabase.from('order_types').select('id');
    if (orderTypes && orderTypes.length > 0) {
      const exists = orderTypes.some(ot => ot.id === Number(order_type_id));
      if (!exists) order_type_id = orderTypes[0].id;
    }

    const orderData = {
      order_type_id: Number(order_type_id),
      payment_type: payment_type || '카드',
      total_amount: total_amount
    };

    if (created_at) orderData.created_at = created_at;
    if (store_id) orderData.store_id = store_id;

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError) throw orderError;

    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: newOrder.id,
        menu_id: item.menu_id === 0 ? null : item.menu_id,
        quantity: item.quantity,
        price: item.price,
        // 선택된 부가옵션 스냅샷. order_items.selected_options 컬럼이 text 타입이므로 JSON 문자열로 저장한다.
        // 예: '[{"group_name":"곱빼기 선택","option_name":"곱빼기","extra_price":1000}]'
        selected_options: JSON.stringify(item.options || [])
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
    }

    res.json({ success: true, order_id: newOrder.id });
  } catch (err) {
    console.error('주문 저장 에러:', err);
    res.status(500).json({ error: '주문 저장 중 서버 오류가 발생했습니다.', details: err.message });
  }
});

// 주문 수정 (기존 주문 항목 전체 교체)
app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  let { order_type_id, payment_type, total_amount, items, created_at } = req.body;

  try {
    const updateData = {
      order_type_id: Number(order_type_id),
      payment_type: payment_type || '카드',
      total_amount: total_amount
    };
    if (created_at) updateData.created_at = created_at;

    const { error: orderError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id);

    if (orderError) throw orderError;

    // 기존 주문 항목 삭제 후 재등록
    const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', id);
    if (deleteError) throw deleteError;

    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: Number(id),
        menu_id: item.menu_id === 0 ? null : item.menu_id,
        quantity: item.quantity,
        price: item.price,
        selected_options: JSON.stringify(item.options || [])
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('주문 수정 에러:', err);
    res.status(500).json({ error: '주문 수정 중 서버 오류가 발생했습니다.', details: err.message });
  }
});

app.get('/api/sales/dates', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('created_at').order('created_at', { ascending: false });
    if (error) throw error;
    const dates = [...new Set(data.map(o => o.created_at.split('T')[0]))];
    res.json(dates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// order_items.selected_options는 text 컬럼에 JSON 문자열로 저장되어 있으므로 파싱해서 내려준다.
const parseSelectedOptions = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

app.get('/api/sales/daily', async (req, res) => {
  const { date } = req.query;
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_types(*), order_items(*, menus(*))`)
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)
      .order('id', { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map(order => ({
      ...order,
      order_items: (order.order_items || []).map(item => ({
        ...item,
        options: parseSelectedOptions(item.selected_options)
      }))
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 월단위/연단위 매출 정산 화면에서 사용 - 지정한 기간(start~end, 둘 다 포함) 사이의 모든 주문을 반환한다.
// (일단위 조회와 동일한 형태로 내려주고, 일/월 단위 집계와 필터링은 프론트에서 처리한다.)
app.get('/api/sales/range', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start, end 쿼리 파라미터가 필요합니다.' });

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_types(*), order_items(*, menus(*))`)
      .gte('created_at', `${start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const formatted = (data || []).map(order => ({
      ...order,
      order_items: (order.order_items || []).map(item => ({
        ...item,
        options: parseSelectedOptions(item.selected_options)
      }))
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// [5] 서버 구동 설정
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`POS Backend Server is running on port ${PORT}`);
});
