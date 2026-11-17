import { render, screen } from '@testing-library/react-native';

import { Character, describeLoadout } from '@/components/Character';
import { defaultEquipped } from '@/domain/shop';

it('renderiza o personagem com rótulo acessível', async () => {
  await render(
    <Character
      equipped={{
        ...defaultEquipped(),
        aura: 'aura-gold',
        pet: 'pet-pig',
        frame: 'frame-gold',
        accessory: 'acc-crown',
      }}
      accessibilityLabel="Seu investidor"
    />,
  );
  expect(screen.getByLabelText('Seu investidor')).toBeTruthy();
});

it('descreve o visual', () => {
  expect(describeLoadout({ ...defaultEquipped(), pet: 'pet-pig' }, (id) => id)).toBe(
    'Seu investidor usando suit-basic, pet-pig',
  );
});
