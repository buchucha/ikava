
import { createClient } from '@supabase/supabase-js';

// 수의사님이 제공해주신 Supabase 연결 정보
const supabaseUrl = 'https://obnddbarhbkrlfaojedg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibmRkYmFyaGJrcmxmYW9qZWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ1NzI3OSwiZXhwIjoyMDg0MDMzMjc5fQ.L8fUCJvnuHo1u-mdyIQFB73gClr0A-6k-3mh5Q8tJUo';

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 실시간 변경 사항 구독 (접수/대기 리스트 등)
 */
export const subscribeToWaitlist = (callback: (payload: any) => void) => {
  return supabase
    .channel('public:waitlist')
    .on('postgres_changes', { event: '*', table: 'waitlist', schema: 'public' }, callback)
    .subscribe();
};
