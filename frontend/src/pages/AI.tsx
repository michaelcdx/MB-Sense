import { motion } from 'motion/react';
import { BrainCircuit, BatteryCharging } from 'lucide-react';
import Chatbot from '../components/Chatbot';
import VoiceAssistant from '../components/VoiceAssistant';

export default function AI() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-5 pb-24 sm:pb-8">
      <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-primary">
              <BrainCircuit className="h-4 w-4" />
              AI
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-on-surface sm:text-4xl">MB Sense AI</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">Predict battery risk before it happens.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-500">
            <BatteryCharging className="h-4 w-4" />
            Charging intelligence
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
        <Chatbot embedded />
        <VoiceAssistant embedded />
      </section>
    </motion.div>
  );
}