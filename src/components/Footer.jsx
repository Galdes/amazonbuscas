import { motion } from 'framer-motion';

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="mt-auto py-8 px-4 text-center text-gray-400 text-sm max-w-2xl mx-auto"
    >
      <p>Desenvolvido com Amazon Product Advertising API 5.0</p>
      <p className="mt-1">Este aplicativo requer credenciais válidas do Programa de Associados da Amazon.</p>
      <p className="mt-3 text-xs text-gray-400">
        Os preços e a disponibilidade dos produtos estão corretos na data/horário indicados e podem sofrer alterações. Quaisquer informações de preço e disponibilidade exibidas na Amazon no momento da compra serão aplicáveis à compra.
      </p>
    </motion.footer>
  );
}
