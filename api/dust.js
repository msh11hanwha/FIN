// Vercel 서버리스 함수: 에어코리아 실시간 대기오염 API 중계 핸들러
export default async function handler(req, res) {
  // GET 요청만 허용하도록 제한
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '허용되지 않는 요청 방식(Method)입니다.' });
  }

  // 1. 요청 쿼리 파라미터에서 sido(시도 이름) 가져오기 (기본값: '서울')
  const { sido = '서울' } = req.query;

  // 2. 서버 환경변수에서 AIRKOREA_KEY 읽기
  const apiKey = process.env.AIRKOREA_KEY;

  // 환경변수에 키가 없을 경우 오류 응답 반환
  if (!apiKey) {
    return res.status(500).json({
      error: '서버 환경변수(AIRKOREA_KEY)가 설정되지 않았습니다. Vercel 또는 .env.local 설정을 확인해주세요.'
    });
  }

  // 3. 환경변수의 Decoding 키를 encodeURIComponent로 인코딩하여 요청 URL 생성
  const encodedKey = encodeURIComponent(apiKey.trim());
  const encodedSido = encodeURIComponent(sido);
  const targetUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedKey}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodedSido}&ver=1.3`;

  try {
    // 4. 공공데이터포털 에어코리아 API 호출
    const apiResponse = await fetch(targetUrl);
    // 텍스트 형태로 먼저 응답 본문 추출 (XML 응답 또는 JSON 응답 모두 수신 가능)
    const textData = await apiResponse.text();

    // 5. 응답이 XML 에러 형태인지 검사 (< 로 시작하거나 XML 에러 태그 포함 여부)
    if (textData.trim().startsWith('<') || textData.includes('<OpenAPI_ServiceResponse>') || textData.includes('<cmmMsgHeader>')) {
      return res.status(400).json({
        error: '인증키 또는 요청값을 확인해주세요.'
      });
    }

    // 6. JSON 파싱 시도
    let jsonData;
    try {
      jsonData = JSON.parse(textData);
    } catch (parseErr) {
      // JSON 파싱 실패 시 XML 등의 비정상 응답이므로 안내 메시지 반환
      return res.status(400).json({
        error: '인증키 또는 요청값을 확인해주세요.'
      });
    }

    // 7. resultCode 성공 여부 확인 (에어코리아 정규 성공 코드는 '00')
    const resultCode = jsonData?.response?.header?.resultCode;
    const resultMsg = jsonData?.response?.header?.resultMsg;

    if (resultCode && resultCode !== '00') {
      return res.status(400).json({
        error: `공공데이터 API 오류: resultCode=${resultCode} (${resultMsg || '오류 발생'}) - 인증키 또는 요청값을 확인해주세요.`
      });
    }

    // 8. 정상 데이터 브라우저로 응답 반환 (캐시 헤더 10분 설정)
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    return res.status(200).json(jsonData);

  } catch (error) {
    // 네트워크 및 서버 내부 예외 처리
    console.error('서버리스 함수 실행 오류:', error);
    return res.status(500).json({
      error: '대기오염 데이터를 가져오는 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    });
  }
}

