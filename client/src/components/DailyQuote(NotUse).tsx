import { useMemo } from "react";
import { motion } from "motion/react";
import { Quote } from "lucide-react";

const QUOTES = [
  { text: "学如逆水行舟，不进则退。", author: "《增广贤文》" },
  { text: "千里之行，始于足下。", author: "老子" },
  { text: "书山有路勤为径，学海无涯苦作舟。", author: "韩愈" },
  { text: "不积跬步，无以至千里。", author: "荀子" },
  { text: "业精于勤，荒于嬉。", author: "韩愈" },
  { text: "天才是百分之一的灵感加百分之九十九的汗水。", author: "爱迪生" },
  { text: "知之者不如好之者，好之者不如乐之者。", author: "孔子" },
  { text: "路漫漫其修远兮，吾将上下而求索。", author: "屈原" },
  { text: "宝剑锋从磨砺出，梅花香自苦寒来。", author: "《警世贤文》" },
  { text: "博学之，审问之，慎思之，明辨之，笃行之。", author: "《中庸》" },
  { text: "锲而不舍，金石可镂。", author: "荀子" },
  { text: "三人行，必有我师焉。", author: "孔子" },
  { text: "温故而知新，可以为师矣。", author: "孔子" },
  { text: "读书破万卷，下笔如有神。", author: "杜甫" },
  { text: "黑发不知勤学早，白首方悔读书迟。", author: "颜真卿" },
  { text: "少壮不努力，老大徒伤悲。", author: "《长歌行》" },
  { text: "吾生也有涯，而知也无涯。", author: "庄子" },
  { text: "敏而好学，不耻下问。", author: "孔子" },
  { text: "纸上得来终觉浅，绝知此事要躬行。", author: "陆游" },
  { text: "人生在勤，不索何获。", author: "张衡" },
  { text: "学而不思则罔，思而不学则殆。", author: "孔子" },
  { text: "玉不琢，不成器；人不学，不知道。", author: "《礼记》" },
  { text: "发奋识遍天下字，立志读尽人间书。", author: "苏轼" },
  { text: "非淡泊无以明志，非宁静无以致远。", author: "诸葛亮" },
  { text: "志不强者智不达。", author: "墨子" },
  { text: "功崇惟志，业广惟勤。", author: "《尚书》" },
  { text: "有志者事竟成。", author: "《后汉书》" },
  { text: "绳锯木断，水滴石穿。", author: "罗大经" },
  { text: "读万卷书，行万里路。", author: "刘彝" },
  { text: "盛年不重来，一日难再晨。", author: "陶渊明" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
];

export default function DailyQuote() {
  const quote = useMemo(() => {
    const today = new Date();
    const dayHash = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return QUOTES[dayHash % QUOTES.length];
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.8 }}
      className="glass rounded-xl px-4 py-3 flex items-start gap-2.5"
    >
      <Quote size={14} className="text-primary/50 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs leading-relaxed text-foreground/80" style={{ fontFamily: "var(--font-display)" }}>
          {quote.text}
        </p>
        <p className="text-[9px] text-muted-foreground mt-1">—— {quote.author}</p>
      </div>
    </motion.div>
  );
}
