import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Code2, 
  Zap, 
  Share2, 
  MessageSquare, 
  Smartphone, 
  Instagram, 
  CheckCircle2, 
  Clock, 
  Puzzle, 
  Headphones,
  Home,
  Stethoscope,
  ShoppingBag,
  Hammer,
  Building2,
  Send,
  ArrowRight
} from 'lucide-react';
import { cn } from './lib/utils';

// --- Components ---

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={cn(
      "fixed top-0 w-full z-50 transition-all duration-300 border-b",
      scrolled ? "glass-effect py-4 border-white/10" : "bg-transparent py-6 border-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 relative">
             <img src="https://ais-pre-6jh6yir4hytd5tmmh2bp5q-484479594327.us-east1.run.app/logo.png" alt="InfraStudio Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <span className="text-white font-extrabold text-2xl tracking-tight">InfraStudio</span>
        </div>
        
        <div className="hidden md:flex items-center space-x-8">
          <a href="#servicos" className="text-sm font-medium text-slate-300 hover:text-blue-400 transition-colors">Serviços</a>
          <a href="#como-funciona" className="text-sm font-medium text-slate-300 hover:text-blue-400 transition-colors">Como Funciona</a>
          <a 
            href="#contato" 
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all shadow-lg shadow-blue-500/20"
          >
            Solicitar Orçamento
          </a>
        </div>
      </div>
    </nav>
  );
};

const ServiceCard = ({ icon: Icon, title, description, delay }: { icon: any, title: string, description: string, delay: number }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="glass-effect p-8 rounded-2xl group hover:border-blue-500/50 transition-all duration-300"
  >
    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 text-blue-500 group-hover:scale-110 transition-transform duration-300">
      <Icon size={24} />
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
  </motion.div>
);

const ChatDemo = () => {
  const [messages, setMessages] = useState<{ text: string, isAi: boolean }[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const script = [
    { text: "Olá! Como posso ajudar sua empresa hoje?", isAi: true, delay: 1000 },
    { text: "Quero automatizar meu atendimento no WhatsApp.", isAi: false, delay: 2000 },
    { text: "Excelente escolha! Nossas IAs reduzem em 80% o trabalho manual e qualificam leads em tempo real. Posso agendar uma demo?", isAi: true, delay: 2500 },
  ];

  useEffect(() => {
    let isMounted = true;
    let current = 0;

    const runScript = async () => {
      if (!isMounted) return;

      if (current >= script.length) {
        await new Promise(r => setTimeout(r, 5000));
        if (isMounted) {
          setMessages([]);
          current = 0;
          runScript();
        }
        return;
      }

      const msg = script[current];
      if (msg.isAi) setIsTyping(true);
      await new Promise(r => setTimeout(r, msg.isAi ? 1500 : 1000));
      
      if (isMounted) {
        setIsTyping(false);
        setMessages(prev => [...prev, msg]);
        current++;
        runScript();
      }
    };

    runScript();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="glass-effect rounded-2xl overflow-hidden border border-white/20 shadow-2xl w-full max-w-md mx-auto lg:mx-0">
      <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/30" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/30" />
          <div className="w-3 h-3 rounded-full bg-green-500/30" />
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Smart AI Interface</div>
      </div>
      <div className="p-6 h-[380px] flex flex-col gap-4 overflow-y-auto bg-slate-900/40">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed",
                msg.isAi 
                  ? "bg-slate-800 text-slate-200 self-start rounded-bl-none" 
                  : "bg-blue-600 text-white self-end rounded-br-none"
              )}
            >
              {msg.text}
            </motion.div>
          ))}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-800 p-3 rounded-2xl rounded-bl-none self-start flex gap-1"
            >
              <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="p-4 border-t border-white/5 flex gap-2">
        <div className="flex-grow bg-white/5 rounded-full px-4 py-2 text-xs text-slate-500 italic">
          {isTyping ? "IA está digitando..." : "Online"}
        </div>
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
          <Send size={14} />
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <div className="min-h-screen bg-grid">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Tecnologia de Ponta & Automação Inteligente
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-7xl font-extrabold text-white leading-[1.1] mb-8 tracking-tight"
          >
            Sistemas, automações e IA para fazer <br className="hidden md:block" /> sua empresa <span className="text-gradient">vender mais</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            Desenvolvemos software sob medida, integrações de APIs e automações inteligentes para WhatsApp e Instagram. Menos esforço manual, mais resultados escaláveis.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a 
              href="#contato" 
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl transition-all shadow-xl shadow-blue-600/20 transform hover:-translate-y-1"
            >
              Solicitar orçamento grátis
            </a>
            <a 
              href="#demonstracao" 
              className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10"
            >
              Ver demonstração
            </a>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 0.5 }}
            className="mt-24 flex flex-wrap justify-center gap-x-12 gap-y-8 grayscale hover:grayscale-0 transition-all duration-500"
          >
            {["Waboxapp", "OpenAI", "Stripe", "Make.com", "AWS"].map((tech) => (
              <span key={tech} className="text-sm font-bold tracking-widest text-slate-300">{tech}</span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="servicos" className="py-24 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Soluções para a Era da Eficiência</h2>
            <p className="text-slate-400">Tudo o que você precisa para digitalizar e escalar sua operação.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <ServiceCard 
              icon={Code2} 
              title="Sistemas Sob Medida" 
              description="Desenvolvimento de softwares exclusivos focados nas necessidades específicas do seu modelo de negócio."
              delay={0.1}
            />
            <ServiceCard 
              icon={Zap} 
              title="Automação de Processos" 
              description="Elimine tarefas repetitivas integrando ferramentas e automatizando fluxos de trabalho complexos."
              delay={0.2}
            />
            <ServiceCard 
              icon={Share2} 
              title="Integração de APIs" 
              description="Conectamos seu CRM, ERP e sistemas de pagamento para que seus dados fluam sem interrupções."
              delay={0.3}
            />
            <ServiceCard 
              icon={MessageSquare} 
              title="IA Chat para Sites" 
              description="Assistentes virtuais inteligentes que entendem o seu produto e respondem clientes 24/7 de forma humana."
              delay={0.4}
            />
            <ServiceCard 
              icon={Smartphone} 
              title="Automação WhatsApp" 
              description="Sistemas de triagem, agendamento e vendas automáticas diretamente no aplicativo mais usado do país."
              delay={0.5}
            />
            <ServiceCard 
              icon={Instagram} 
              title="Instagram Automation" 
              description="Respostas automáticas no Direct e comentários que transformam seguidores em leads qualificados instantaneamente."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* Proof Section */}
      <section id="demonstracao" className="py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="lg:w-1/2">
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-8 leading-tight">A experiência é a nossa maior prova.</h2>
              <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                Não apenas falamos sobre tecnologia, nós a vivemos. Esta página e nossos sistemas são construídos com a mesma excelência que entregamos aos nossos clientes.
              </p>
              
              <div className="space-y-6">
                {[
                  { title: "IA Nativa", desc: "Integração real com modelos GPT-4 para atendimento." },
                  { title: "Alta Performance", desc: "Carregamento instantâneo e UI intuitiva." }
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-colors">
                    <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">{item.title}</h4>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="lg:w-1/2 w-full flex justify-center lg:justify-end">
              <ChatDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-24 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              { icon: Zap, title: "Produtividade", desc: "Foque no que importa, deixe a rotina com a gente." },
              { icon: Clock, title: "Menos Manual", desc: "Erros humanos reduzidos a quase zero." },
              { icon: Puzzle, title: "Integrado", desc: "Toda sua stack conversando em tempo real." },
              { icon: Headphones, title: "Suporte Veloz", desc: "Time técnico direto no WhatsApp para você." }
            ].map((item, i) => (
              <div key={i} className="text-center group">
                <div className="text-blue-500 mb-6 flex justify-center group-hover:scale-110 transition-transform">
                  <item.icon size={40} strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="como-funciona" className="py-32 bg-slate-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Do problema à eficiência em 5 passos</h2>
          </div>

          <div className="relative">
            <div className="hidden lg:block absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent -translate-y-1/2" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 relative z-10">
              {[
                { n: "1", title: "Explique a Dor", desc: "Conte-nos o que trava o crescimento da sua empresa hoje." },
                { n: "2", title: "Diagnóstico", desc: "Analisamos a melhor stack tecnológica para resolver." },
                { n: "3", title: "Arquitetura", desc: "Desenvolvemos o projeto lógico e visual do seu sistema." },
                { n: "4", title: "Mão na Massa", desc: "Nossa equipe de especialistas codifica sua solução." },
                { n: "5", title: "Eficiência", desc: "Entrega, treinamento e colheita de resultados.", highlight: true }
              ].map((step, i) => (
                <div key={i} className="bg-brand-dark p-8 rounded-2xl border border-white/10 text-center hover:border-blue-500/30 transition-colors">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mx-auto mb-6 shadow-lg",
                    step.highlight ? "bg-emerald-500 shadow-emerald-500/20" : "bg-blue-600 shadow-blue-600/20"
                  )}>
                    {step.n}
                  </div>
                  <h4 className="font-bold text-white mb-3">{step.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Business Types */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Feito para quem busca escala</h2>
            <p className="text-slate-400">Soluções adaptadas para diferentes nichos de mercado.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { icon: Home, label: "Imobiliárias" },
              { icon: Stethoscope, label: "Clínicas" },
              { icon: ShoppingBag, label: "Lojas" },
              { icon: Hammer, label: "Prestadores" },
              { icon: Building2, label: "PMEs" }
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-center group cursor-default">
                <div className="text-slate-400 group-hover:text-blue-400 transition-colors mb-4 flex justify-center">
                  <item.icon size={32} strokeWidth={1.5} />
                </div>
                <h4 className="font-bold text-white text-sm">{item.label}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="contato" className="py-32 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="glass-effect p-12 md:p-20 rounded-[40px] border-blue-500/20 shadow-2xl relative overflow-hidden text-center">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
            
            <h2 className="text-3xl md:text-6xl font-extrabold text-white mb-8 tracking-tight">Pronto para o próximo nível?</h2>
            <p className="text-slate-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
              Fale sobre sua ideia e receba uma proposta personalizada sem compromisso. Nosso time técnico entrará em contato.
            </p>
            
            <a 
              href="https://wa.me/5511999999999" 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-10 py-5 bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold text-xl rounded-2xl transition-all transform hover:scale-105 shadow-2xl shadow-[#25D366]/20"
            >
              <Smartphone size={24} />
              Chamar no WhatsApp
            </a>
            <p className="mt-8 text-slate-500 text-sm font-medium">Respostas em menos de 1 hora em horário comercial.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-brand-dark relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="max-w-sm">
              <div className="flex items-center gap-2 mb-6">
                <img src="https://ais-pre-6jh6yir4hytd5tmmh2bp5q-484479594327.us-east1.run.app/logo.png" alt="Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                <span className="text-white font-bold text-xl tracking-tight">InfraStudio</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Tecnologia sob medida para acelerar negócios brasileiros com inteligência e automação. Transformamos processos complexos em resultados simples.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-20">
              <div className="flex flex-col gap-4">
                <span className="text-white font-bold text-sm uppercase tracking-widest">Soluções</span>
                <nav className="flex flex-col gap-3">
                  {["Automações", "Sistemas", "IA", "API Integrations"].map(link => (
                    <a key={link} href="#" className="text-slate-500 text-sm hover:text-blue-400 transition-colors">{link}</a>
                  ))}
                </nav>
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-white font-bold text-sm uppercase tracking-widest">Empresa</span>
                <nav className="flex flex-col gap-3">
                  {["Sobre nós", "Privacidade", "Contato", "Carreiras"].map(link => (
                    <a key={link} href="#" className="text-slate-500 text-sm hover:text-blue-400 transition-colors">{link}</a>
                  ))}
                </nav>
              </div>
            </div>
          </div>
          
          <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-slate-600 font-medium">
            <p>© {new Date().getFullYear()} InfraStudio. Todos os direitos reservados.</p>
            <div className="flex items-center gap-1">
              Desenvolvido com <span className="text-red-500">❤️</span> para a produtividade.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
