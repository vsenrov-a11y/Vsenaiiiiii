import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Gift, History, ArrowUpRight, ArrowDownRight, ShoppingCart } from 'lucide-react';
import { playOrbEarnSound } from '../../utils/orbAudio';
import { StorageConfig } from '../../types';

const PearlIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={`relative rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-300 shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.1),inset_2px_2px_6px_rgba(255,255,255,0.9),0_0_15px_rgba(255,255,255,0.2)] ${className}`}>
    <div className="absolute top-[15%] left-[15%] w-[30%] h-[30%] rounded-full bg-white opacity-80 blur-[1px]" />
  </div>
);

interface OrbWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageConfig: StorageConfig;
  onUpdateConfig: (updates: Partial<StorageConfig>) => void;
}

export const OrbWalletModal: React.FC<OrbWalletModalProps> = ({
  isOpen,
  onClose,
  storageConfig,
  onUpdateConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'earn' | 'buy' | 'history'>('earn');

  if (!isOpen) return null;

  const currentOrbs = storageConfig.orbs !== undefined ? storageConfig.orbs : 50;
  const transactions = storageConfig.orbTransactions || [];
  
  const now = Date.now();
  const lastClaim = storageConfig.lastDailyClaimTimestamp || 0;
  const timeSinceLastClaim = now - lastClaim;
  const canClaimDaily = timeSinceLastClaim >= 24 * 60 * 60 * 1000;
  const hoursUntilNextClaim = canClaimDaily ? 0 : Math.ceil((24 * 60 * 60 * 1000 - timeSinceLastClaim) / (60 * 60 * 1000));

  const handleClaimDaily = () => {
    if (!canClaimDaily) return;
    playOrbEarnSound();

    const newAmount = currentOrbs + 20;
    const newTx = {
      id: `tx-${Date.now()}`,
      amount: 20,
      reason: 'Daily Login Bonus',
      timestamp: Date.now(),
    };

    onUpdateConfig({
      orbs: newAmount,
      orbTransactions: [newTx, ...transactions],
      lastDailyClaimTimestamp: Date.now(),
    });
  };

  const handleWatchAd = () => {
    playOrbEarnSound();
    
    const newAmount = currentOrbs + 15;
    const newTx = {
      id: `tx-${Date.now()}`,
      amount: 15,
      reason: 'Watched Ad',
      timestamp: Date.now(),
    };

    onUpdateConfig({
      orbs: newAmount,
      orbTransactions: [newTx, ...transactions],
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[190] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xl font-sans select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="w-full max-w-lg bg-[#0b0c10] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white max-h-[90dvh]"
        >
          {/* Header Bar */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <PearlIcon className="w-5 h-5" />
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Orb Wallet
                </h2>
                <p className="text-xs text-white/50">Manage your balance</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Balance Hero Card */}
          <div className="p-6 bg-gradient-to-br from-white/5 to-transparent border-b border-white/10 flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-white/60 font-medium mb-1">Total Balance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white font-mono">{currentOrbs}</span>
              </div>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex border-b border-white/10 bg-black/40">
            {[
              { id: 'earn', label: 'Earn', icon: Gift },
              { id: 'buy', label: 'Buy', icon: ShoppingCart },
              { id: 'history', label: 'History', icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors border-b-2 cursor-pointer ${
                    isActive
                      ? 'border-white text-white bg-white/5'
                      : 'border-transparent text-white/50 hover:text-white/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {activeTab === 'earn' && (
              <div className="space-y-3">
                {/* 1. Rewarded Ad Button */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:border-white/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                      <Play className="w-5 h-5 fill-white" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Watch Ad</h4>
                      <p className="text-[11px] text-white/50">Watch a 10s ad for instant balance</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleWatchAd}
                    className="px-3.5 py-2 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold shadow-md flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <span>+15</span>
                  </button>
                </div>

                {/* 2. Daily Login Bonus */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:border-white/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Daily Bonus</h4>
                      <p className="text-[11px] text-white/50">Claim 20 free balance every 24 hours</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canClaimDaily}
                    onClick={handleClaimDaily}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      !canClaimDaily
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-white/90 active:scale-95'
                    }`}
                  >
                    <span>{!canClaimDaily ? `In ${hoursUntilNextClaim}h` : '+20'}</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'buy' && (
              <div className="space-y-3">
                {[
                  { orbs: 100, price: "$0.99" },
                  { orbs: 250, price: "$1.99" },
                  { orbs: 500, price: "$2.99" },
                  { orbs: 1000, price: "$3.99" },
                  { orbs: 2000, price: "$5.99" },
                  { orbs: "Unlimited (7 days)", price: "$7.99" },
                ].map((pack, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:border-white/20 transition-all">
                    <div className="flex items-center gap-3">
                      <PearlIcon className="w-8 h-8" />
                      <div>
                        <h4 className="text-sm font-bold text-white">{pack.orbs} Orbs</h4>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Mock purchase for now
                        playOrbEarnSound();
                        if (typeof pack.orbs === 'number') {
                          const newAmount = currentOrbs + pack.orbs;
                          const newTx = {
                            id: `tx-${Date.now()}`,
                            amount: pack.orbs,
                            reason: `Purchased Orbs`,
                            timestamp: Date.now(),
                          };
                          onUpdateConfig({
                            orbs: newAmount,
                            orbTransactions: [newTx, ...transactions],
                          });
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold shadow-md cursor-pointer active:scale-95"
                    >
                      {pack.price}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-white/40">No transactions recorded yet.</div>
                ) : (
                  transactions.map((tx) => {
                    const isPlus = tx.amount > 0;
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                              isPlus ? 'bg-white/20 text-white' : 'bg-black/20 text-white/70'
                            }`}
                          >
                            {isPlus ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="text-white font-medium block">{tx.reason}</span>
                            <span className="text-[10px] text-white/40 font-mono">
                              {new Date(tx.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`font-mono font-bold flex items-center gap-1 ${
                            isPlus ? 'text-white' : 'text-white/70'
                          }`}
                        >
                          {isPlus ? `+${tx.amount}` : tx.amount}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
