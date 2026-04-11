import { Winner, GrandPrize } from '@/types';

export const mockWinners: Winner[] = [
  { id: 'w1', name: 'Maria S.', city: 'São Paulo', amount: 25.0, type: 'coupon', date: '2026-04-07' },
  { id: 'w2', name: 'João P.', city: 'Rio de Janeiro', amount: 15.0, type: 'coupon', date: '2026-04-07' },
  { id: 'w3', name: 'Ana L.', city: 'Belo Horizonte', amount: 50.0, type: 'coupon', date: '2026-04-06' },
  { id: 'w4', name: 'Carlos M.', city: 'Curitiba', amount: 30.0, type: 'coupon', date: '2026-04-06' },
  { id: 'w5', name: 'Fernanda R.', city: 'Salvador', amount: 20.0, type: 'coupon', date: '2026-04-05' },
  { id: 'w6', name: 'Pedro H.', city: 'Fortaleza', amount: 40.0, type: 'coupon', date: '2026-04-05' },
  { id: 'w7', name: 'Luciana G.', city: 'Brasília', amount: 35.0, type: 'coupon', date: '2026-04-04' },
  { id: 'w8', name: 'Roberto F.', city: 'Manaus', amount: 10.0, type: 'coupon', date: '2026-04-04' },
];

export const mockGrandPrize: GrandPrize = {
  id: 'gp1',
  title: 'GRANDE PRÊMIO Caça ao Tesouro PIX',
  value: 50000.0,
  imageUrl: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80',
  backgroundImageUrl: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/lzwqp0xqv9sap6qidr2cz.png',
  drawDate: '2026-05-15',
  lotteryReference: 'Loteria Federal - 1º ao 5º prêmio',
  description:
    'Concorra ao grande prêmio de R$ 50.000,00! Cada cupom escaneado já tem número para participar. O sorteio é baseado na Loteria Federal, do 1º ao 5º prêmio. Prêmio em PIX para os ganhadores. Quanto mais cupons, mais chances de ganhar! Datas de sorteio definidas pelo administrador.',
  isActive: true,
  city: 'São Paulo',
  state: 'SP',
};
