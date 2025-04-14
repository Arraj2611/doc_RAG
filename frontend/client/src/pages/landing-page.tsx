import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  MessageSquareText, 
  Brain, 
  Search, 
  Zap, 
  Users, 
  ShieldCheck, 
  ChevronRight,
  Menu,
  X
} from "lucide-react";

export default function LandingPage() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
  };

  const rise = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { 
        delay: i * 0.1,
        duration: 0.5,
      },
    }),
  };

  const features = [
    {
      icon: <FileText className="h-7 w-7 text-blue-500" />,
      title: "Document Analysis",
      description: "Upload and process documents of any size with our advanced AI system."
    },
    {
      icon: <Brain className="h-7 w-7 text-indigo-500" />,
      title: "AI-Powered Insights",
      description: "Extract key insights and summaries from your documents automatically."
    },
    {
      icon: <MessageSquareText className="h-7 w-7 text-violet-500" />,
      title: "Conversational Interface",
      description: "Chat with your documents to find information quickly and efficiently."
    },
    {
      icon: <Search className="h-7 w-7 text-purple-500" />,
      title: "Semantic Search",
      description: "Find what you need with natural language queries across all your documents."
    },
    {
      icon: <Zap className="h-7 w-7 text-pink-500" />,
      title: "Instant Processing",
      description: "Get immediate results with our high-performance document processing pipeline."
    },
    {
      icon: <ShieldCheck className="h-7 w-7 text-emerald-500" />,
      title: "Secure & Private",
      description: "Your documents are encrypted and secure at all times. Your data stays private."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/70 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-400">
                DocuMind AI
              </h1>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8 items-center">
              <a href="#features" className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition">
                Features
              </a>
              <a href="#how-it-works" className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition">
                How It Works
              </a>
              {user ? (
                <Link href="/">
                  <Button>Dashboard</Button>
                </Link>
              ) : (
                <Link href="/auth">
                  <Button>Sign In</Button>
                </Link>
              )}
            </nav>
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <a 
                href="#features" 
                className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a 
                href="#how-it-works" 
                className="block px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </a>
              {user ? (
                <Link href="/">
                  <a className="block px-3 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700">
                    Dashboard
                  </a>
                </Link>
              ) : (
                <Link href="/auth">
                  <a className="block px-3 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700">
                    Sign In
                  </a>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-200/20 via-transparent to-transparent dark:from-blue-900/20"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeIn}
              >
                <motion.h2 
                  className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6"
                  custom={1}
                  variants={rise}
                >
                  Unlock the Power of Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500">Documents</span>
                </motion.h2>
                
                <motion.p 
                  className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto"
                  custom={2}
                  variants={rise}
                >
                  AI-powered document analysis, insights, and chat interface to transform how you work with content.
                </motion.p>
                
                <motion.div 
                  className="flex flex-col sm:flex-row gap-4 justify-center mb-20"
                  custom={3}
                  variants={rise}
                >
                  <Link href="/auth">
                    <Button size="lg" className="px-8 py-6 text-md">
                      Get Started for Free
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  
                  <a href="#how-it-works">
                    <Button size="lg" variant="outline" className="px-8 py-6 text-md">
                      How It Works
                    </Button>
                  </a>
                </motion.div>
              </motion.div>
              
              {/* Hero Image */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="relative mx-auto max-w-5xl"
              >
                <div className="w-full rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm overflow-hidden">
                  <div className="h-12 bg-gray-100 dark:bg-gray-800 flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="p-4 h-64 md:h-80 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-4 w-full h-full">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex flex-col">
                        <div className="text-sm font-medium mb-2">Document Analysis</div>
                        <div className="flex-1 flex items-center justify-center">
                          <FileText className="h-12 w-12 text-blue-500" />
                        </div>
                        <div className="h-2 bg-blue-200 rounded-full mt-auto">
                          <div className="h-2 bg-blue-500 rounded-full w-3/4"></div>
                        </div>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex flex-col">
                        <div className="text-sm font-medium mb-2">AI Chat Interface</div>
                        <div className="flex-1 flex items-center justify-center">
                          <MessageSquareText className="h-12 w-12 text-indigo-500" />
                        </div>
                        <div className="h-2 bg-indigo-200 rounded-full mt-auto">
                          <div className="h-2 bg-indigo-500 rounded-full w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section id="features" className="py-20 bg-white dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Powerful Features</h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                Explore the capabilities of our document AI system
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={index}
                  variants={rise}
                  className="p-6 border border-gray-200 dark:border-gray-800 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 inline-block rounded-lg">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        
        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">How It Works</h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                A simple process to start analyzing your documents in minutes
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={1}
                variants={rise}
                className="relative"
              >
                <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                  <span className="text-2xl font-bold">1</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Upload Documents</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Drag and drop your PDFs or documents into the platform
                </p>
              </motion.div>
              
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={2}
                variants={rise}
                className="relative"
              >
                <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                  <span className="text-2xl font-bold">2</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">AI Processing</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Our AI analyzes your documents and prepares them for interaction
                </p>
              </motion.div>
              
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={3}
                variants={rise}
                className="relative"
              >
                <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300">
                  <span className="text-2xl font-bold">3</span>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Chat & Explore</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Ask questions, extract insights, and interact naturally with your content
                </p>
              </motion.div>
            </div>
            
            <div className="mt-20 text-center">
              <Link href="/auth">
                <Button size="lg" className="px-8 py-6 text-md">
                  Get Started Now
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-shrink-0 mb-6 md:mb-0">
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-400">
                DocuMind AI
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Your AI Document Assistant
              </p>
            </div>
            
            <div className="flex space-x-6 md:ml-12">
              <a href="#" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                Terms
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                Privacy
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                Contact
              </a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              &copy; {new Date().getFullYear()} DocuMind AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}