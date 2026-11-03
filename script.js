// Vercel 서버리스 프록시 API 엔드포인트 주소
const INTERNAL_API_BASE_URL = '/api/dust';

// 전역 Chart.js 차트 인스턴스 저장 변수
let dustBarChartInstance = null;

// DOM 요소 참조: 시도 선택 셀렉트박스
const sidoSelect = document.getElementById('sidoSelect');
// DOM 요소 참조: 상단 신호등 카드 전체 영역
const trafficLightCard = document.getElementById('trafficLightCard');
// DOM 요소 참조: 상단 지역명 배지
const selectedRegionName = document.getElementById('selectedRegionName');
// DOM 요소 참조: 상단 기준 시각 표시 영역
const standardTime = document.getElementById('standardTime');
// DOM 요소 참조: 상단 신호등 대형 이모지 영역
const trafficEmoji = document.getElementById('trafficEmoji');
// DOM 요소 참조: 상단 상태명(좋음/보통/나쁨/매우나쁨) 텍스트 영역
const trafficStatusText = document.getElementById('trafficStatusText');
// DOM 요소 참조: 상단 평균 미세먼지 수치 텍스트 영역
const averageValue = document.getElementById('averageValue');
// DOM 요소 참조: 상단 한 줄 행동 가이드 배너 영역
const trafficGuideBanner = document.getElementById('trafficGuideBanner');
// DOM 요소 참조: 차트 섹션 컨테이너
const chartSection = document.getElementById('chartSection');
// DOM 요소 참조: 측정소 카드 목록 컨테이너
const stationGrid = document.getElementById('stationGrid');

// 날짜 및 시각 문자열("2026-10-28 16:00")을 한국어 형식("2026년 10월 28일 16시 기준")으로 변환하는 함수
function formatKoreanDateTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return '측정 시각 정보 없음';
  }

  const match = timeStr.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})/);

  if (match) {
    const [_, year, month, day, hour, minute] = match;
    const mNum = parseInt(minute, 10);
    const minuteSuffix = mNum > 0 ? ` ${mNum}분` : '';
    return `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일 ${parseInt(hour, 10)}시${minuteSuffix} 기준`;
  }

  return `${timeStr} 기준`;
}

// 등급 코드(1, 2, 3, 4)를 한글 등급명과 CSS 클래스명으로 변환하는 함수
function getGradeInfo(gradeCode) {
  if (gradeCode === '1') {
    return { name: '좋음', className: 'grade-1', badgeClass: 'badge-1', color: '#2563eb' };
  }
  if (gradeCode === '2') {
    return { name: '보통', className: 'grade-2', badgeClass: 'badge-2', color: '#16a34a' };
  }
  if (gradeCode === '3') {
    return { name: '나쁨', className: 'grade-3', badgeClass: 'badge-3', color: '#ea580c' };
  }
  if (gradeCode === '4') {
    return { name: '매우나쁨', className: 'grade-4', badgeClass: 'badge-4', color: '#dc2626' };
  }
  return { name: '측정불가', className: 'grade-unknown', badgeClass: 'badge-unknown', color: '#94a3b8' };
}

// 등급 코드에 따른 단일 색상(HEX) 반환 함수
function getGradeColor(gradeCode) {
  if (gradeCode === '1') return '#2563eb'; // 파랑 (좋음)
  if (gradeCode === '2') return '#16a34a'; // 초록 (보통)
  if (gradeCode === '3') return '#ea580c'; // 주황 (나쁨)
  if (gradeCode === '4') return '#dc2626'; // 빨강 (매우나쁨)
  return '#94a3b8';                       // 회색 (측정불가)
}

// 측정 수치 포맷팅 함수 (값이 "-" 또는 비어있으면 "측정 안 됨" 반환)
function formatMeasureValue(val, unit = '㎍/㎥') {
  if (!val || val.trim() === '' || val.trim() === '-') {
    return '<span class="item-value not-measured">측정 안 됨</span>';
  }
  return `<span class="item-value">${val} ${unit}</span>`;
}

// 평균 미세먼지 수치를 바탕으로 대표 신호등 상태 객체를 반환하는 함수
function getTrafficState(avgNumber) {
  if (avgNumber === null || isNaN(avgNumber)) {
    return {
      emoji: '⚪',
      statusText: '측정 불가',
      themeClass: '',
      guideText: '현재 수집된 유효한 측정 데이터가 없습니다.'
    };
  }
  if (avgNumber <= 30) {
    return {
      emoji: '🔵',
      statusText: '좋음',
      themeClass: 'theme-good',
      guideText: '공기가 깨끗해요! 산책과 실내 환기에 좋은 날입니다.'
    };
  }
  if (avgNumber <= 80) {
    return {
      emoji: '🟢',
      statusText: '보통',
      themeClass: 'theme-normal',
      guideText: '무난한 공기질이에요. 일상 활동에 지장 없어요.'
    };
  }
  if (avgNumber <= 150) {
    return {
      emoji: '🟠',
      statusText: '나쁨',
      themeClass: 'theme-bad',
      guideText: '외출 시 마스크를 챙기세요 😷'
    };
  }
  return {
    emoji: '🔴',
    statusText: '매우나쁨',
    themeClass: 'theme-very-bad',
    guideText: '외출 시 마스크를 챙기세요 😷 (가급적 야외 활동을 자제하세요)'
  };
}

// 상단 대표 신호등 UI 갱신 함수
function updateTrafficLightUI(avgNumber, latestTime) {
  trafficLightCard.classList.remove('theme-good', 'theme-normal', 'theme-bad', 'theme-very-bad');

  const state = getTrafficState(avgNumber);

  if (state.themeClass) {
    trafficLightCard.classList.add(state.themeClass);
  }

  trafficEmoji.textContent = state.emoji;
  trafficStatusText.textContent = state.statusText;
  averageValue.textContent = avgNumber !== null ? avgNumber.toFixed(1) : '-';
  trafficGuideBanner.textContent = state.guideText;
  standardTime.textContent = formatKoreanDateTime(latestTime);
}

// [신규] Chart.js를 이용한 미세먼지 상위 10개 측정소 가로 막대그래프 렌더링 함수
function renderDustBarChart(items) {
  // 1. '측정 안 됨'인 측정소 제외하고 순수 숫자값만 필터링
  const validItems = items.filter(item => {
    const val = item.pm10Value;
    return val && val.trim() !== '' && val.trim() !== '-' && !isNaN(parseFloat(val));
  });

  // 유효한 측정소가 없을 경우 차트 섹션 숨김 처리
  if (validItems.length === 0) {
    chartSection.style.display = 'none';
    return;
  }

  // 차트 섹션 표시
  chartSection.style.display = 'block';

  // 2. 미세먼지 수치 기준 내림차순 정렬 후 상위 10개만 슬라이스
  const top10Items = validItems
    .map(item => ({
      stationName: item.stationName || '알 수 없음',
      pm10Value: parseFloat(item.pm10Value),
      pm10Grade: item.pm10Grade
    }))
    .sort((a, b) => b.pm10Value - a.pm10Value)
    .slice(0, 10);

  // 3. 차트용 데이터 배열 추출 (측정소명, 수치, 등급별 막대 색상)
  const labels = top10Items.map(item => item.stationName);
  const dataValues = top10Items.map(item => item.pm10Value);
  const barColors = top10Items.map(item => getGradeColor(item.pm10Grade));

  // 4. 기존 차트 인스턴스가 존재할 경우 파괴하여 캔버스 재사용 오류 방지
  if (dustBarChartInstance) {
    dustBarChartInstance.destroy();
  }

  // 5. 캔버스 엘리먼트 가져오기
  const ctx = document.getElementById('dustBarChart').getContext('2d');

  // 6. 가로 막대그래프 생성
  dustBarChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '미세먼지 (PM10)',
        data: dataValues,
        backgroundColor: barColors,
        borderRadius: 8,              // 막대 모서리 둥글게
        borderSkipped: false,         // 모든 모서리 곡률 유지
        barThickness: 20              // 막대 두께 고정
      }]
    },
    options: {
      indexAxis: 'y',                 // 가로 막대그래프 핵심 설정
      responsive: true,               // 반응형 지원
      maintainAspectRatio: false,     // 부모 높이에 맞춤
      plugins: {
        legend: {
          display: false              // 상단 기본 범례 숨김 (개별 색상이므로)
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Pretendard', size: 13, weight: 'bold' },
          bodyFont: { family: 'Pretendard', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const item = top10Items[context.dataIndex];
              const grade = getGradeInfo(item.pm10Grade).name;
              return ` 미세먼지: ${context.parsed.x} ㎍/㎥ (등급: ${grade})`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,          // 0부터 시작
          grid: {
            color: '#f1f5f9'          // 연한 가로 그리드선
          },
          ticks: {
            font: { family: 'Pretendard', size: 11 },
            color: '#64748b',
            callback: function(val) {
              return val + ' ㎍/㎥';   // 눈금에 단위 표기
            }
          }
        },
        y: {
          grid: {
            display: false            // Y축 그리드선 숨김
          },
          ticks: {
            font: { family: 'Pretendard', size: 12, weight: '600' },
            color: '#1e293b'
          }
        }
      }
    }
  });
}

// Vercel 서버리스 함수(/api/dust)를 통해 대기오염 데이터를 호출하는 비동기 함수
async function fetchAirQualityData(sidoName) {
  selectedRegionName.textContent = sidoName;
  standardTime.textContent = '불러오는 중...';
  trafficEmoji.textContent = '⏳';
  trafficStatusText.textContent = '불러오는 중...';
  averageValue.textContent = '-';
  trafficGuideBanner.textContent = '공기 데이터를 불러오는 중입니다...';
  stationGrid.innerHTML = '<div class="message-box">불러오는 중...</div>';

  try {
    const requestUrl = `${INTERNAL_API_BASE_URL}?sido=${encodeURIComponent(sidoName)}`;
    const response = await fetch(requestUrl);
    const data = await response.json();

    if (!response.ok || data.error) {
      const errorMessage = data.error || '대기오염 정보를 가져오지 못했습니다.';
      stationGrid.innerHTML = `
        <div class="message-box">
          <strong>[안내]</strong><br>
          ${errorMessage}
        </div>
      `;
      updateTrafficLightUI(null, null);
      if (dustBarChartInstance) dustBarChartInstance.destroy();
      chartSection.style.display = 'none';
      trafficGuideBanner.textContent = '데이터를 불러올 수 없습니다.';
      return;
    }

    const items = data?.response?.body?.items;

    if (!items || items.length === 0) {
      stationGrid.innerHTML = `<div class="message-box">${sidoName} 지역에 조회된 측정소 데이터가 없습니다.</div>`;
      updateTrafficLightUI(null, null);
      if (dustBarChartInstance) dustBarChartInstance.destroy();
      chartSection.style.display = 'none';
      trafficGuideBanner.textContent = '조회된 측정소가 없습니다.';
      return;
    }

    renderStationData(items);

  } catch (error) {
    console.error('API 호출 실패:', error);
    stationGrid.innerHTML = `
      <div class="message-box">
        데이터를 불러오는 중 네트워크 오류가 발생했습니다.<br>
        (개발 서버 상태 또는 인터넷 연결을 확인해주세요.)
      </div>
    `;
    updateTrafficLightUI(null, null);
    if (dustBarChartInstance) dustBarChartInstance.destroy();
    chartSection.style.display = 'none';
    trafficGuideBanner.textContent = '네트워크 연결 상태를 확인해주세요.';
  }
}

// 측정소 목록 카드 렌더링 및 평균값 계산 함수
function renderStationData(items) {
  let pm10Sum = 0;
  let validPm10Count = 0;
  let latestTime = null;
  let cardsHtml = '';

  items.forEach(item => {
    const station = item.stationName || '알 수 없음';
    const pm10 = item.pm10Value;
    const pm25 = item.pm25Value;
    const time = item.dataTime || '';
    const grade = item.pm10Grade;

    if (!latestTime && time) {
      latestTime = time;
    }

    if (pm10 && pm10.trim() !== '' && pm10.trim() !== '-') {
      const num = parseFloat(pm10);
      if (!isNaN(num)) {
        pm10Sum += num;
        validPm10Count += 1;
      }
    }

    const gradeInfo = getGradeInfo(grade);
    const koreanTimeText = formatKoreanDateTime(time);

    cardsHtml += `
      <article class="station-card ${gradeInfo.className}">
        <header class="card-header">
          <h2 class="station-name">${station}</h2>
          <span class="grade-badge ${gradeInfo.badgeClass}">${gradeInfo.name}</span>
        </header>

        <div class="card-body">
          <div class="card-row">
            <span class="item-title">미세먼지 (PM10)</span>
            ${formatMeasureValue(pm10)}
          </div>
          <div class="card-row">
            <span class="item-title">초미세먼지 (PM2.5)</span>
            ${formatMeasureValue(pm25)}
          </div>
        </div>

        <footer class="card-footer">
          ${koreanTimeText}
        </footer>
      </article>
    `;
  });

  stationGrid.innerHTML = cardsHtml;

  // 상단 공기 신호등 업데이트
  if (validPm10Count > 0) {
    const average = pm10Sum / validPm10Count;
    updateTrafficLightUI(average, latestTime);
  } else {
    updateTrafficLightUI(null, latestTime);
  }

  // [신규] 상위 10개 측정소 가로 막대그래프 렌더링 호출
  renderDustBarChart(items);
}

// 시도 선택 셀렉트박스 변경 이벤트 리스너
sidoSelect.addEventListener('change', (event) => {
  fetchAirQualityData(event.target.value);
});

// 문서 로드 완료 시 기본 선택(서울)으로 데이터 조회 실행
document.addEventListener('DOMContentLoaded', () => {
  fetchAirQualityData(sidoSelect.value);
});
