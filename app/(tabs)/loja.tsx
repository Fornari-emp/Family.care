import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Character, describeLoadout } from '@/components/Character';
import { Dialog } from '@/components/Dialog';
import { FreezeCard } from '@/components/FreezeCard';
import { Icon, isIconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { getItem, ITEMS, previewLoadout, SHOP_GROUPS, type CosmeticItem } from '@/domain/shop';
import { useAct } from '@/feedback/useAct';
import { useGame } from '@/store';
import { alpha, colors, fonts, MIN_TOUCH, radius } from '@/theme';

const itemName = (id: string) => getItem(id)?.name ?? id;

export default function ShopScreen() {
  const coins = useGame((s) => s.state.coins);
  const owned = useGame((s) => s.state.ownedItems);
  const equipped = useGame((s) => s.state.equipped);
  const doAct = useAct();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [buying, setBuying] = useState<CosmeticItem | null>(null);

  const shown = previewId ? previewLoadout(equipped, previewId) : equipped;
  const previewItem = previewId ? getItem(previewId) : undefined;

  return (
    <Screen testID="screen-loja">
      <Card tone="raised">
        <View style={styles.rowBetween}>
          <AppText variant="label">
            {previewItem ? `Prévia: ${previewItem.name}` : 'Seu investidor'}
          </AppText>
          <View style={styles.rowGap} accessible accessibilityLabel={`Saldo: ${coins} moedas`}>
            <Icon name="coin" size={15} color={colors.gold} />
            <AppText style={styles.balance}>{coins.toLocaleString('pt-BR')}</AppText>
          </View>
        </View>
        <View style={styles.center}>
          <Character
            equipped={shown}
            size={170}
            accessibilityLabel={`${previewItem ? 'Prévia. ' : ''}${describeLoadout(shown, itemName)}`}
          />
        </View>
        {previewId ? (
          <Button
            label="Voltar ao visual atual"
            variant="ghost"
            compact
            onPress={() => setPreviewId(null)}
          />
        ) : (
          <AppText variant="caption" center>
            Toque em um item para ver como fica antes de comprar.
          </AppText>
        )}
      </Card>

      <FreezeCard />

      {SHOP_GROUPS.map((g) => (
        <View key={g.slot} style={styles.group}>
          <SectionHeader title={g.title} />
          <View style={styles.grid}>
            {ITEMS.filter((i) => i.slot === g.slot).map((item) => {
              const isOwned = owned.includes(item.id);
              const isEquipped = equipped[item.slot] === item.id;
              const affordable = coins >= item.price;
              const selected = previewId === item.id;
              const state = isEquipped ? 'equipado' : isOwned ? 'comprado' : `${item.price} moedas`;
              return (
                <View key={item.id} style={[styles.item, selected && styles.itemSelected]}>
                  <Pressable
                    onPress={() => setPreviewId(selected ? null : item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${state}. Ver prévia`}
                    accessibilityState={{ selected }}
                    style={styles.itemTop}
                  >
                    <View style={[styles.itemIcon, { backgroundColor: alpha(item.tint, 0.15) }]}>
                      {isIconName(item.icon) ? (
                        <Icon name={item.icon} size={26} color={item.tint} />
                      ) : null}
                    </View>
                    <AppText style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <View style={styles.rowGap}>
                      {!isOwned ? <Icon name="coin" size={12} color={colors.gold} /> : null}
                      <AppText variant="caption" color={isOwned ? colors.money : colors.goldLight}>
                        {isOwned
                          ? isEquipped
                            ? 'Equipado'
                            : 'Comprado'
                          : item.price.toLocaleString('pt-BR')}
                      </AppText>
                    </View>
                  </Pressable>
                  {isEquipped ? (
                    item.slot === 'suit' ? (
                      <View style={styles.equippedTag}>
                        <AppText style={styles.equippedText}>Em uso</AppText>
                      </View>
                    ) : (
                      <Button
                        label="Remover"
                        variant="secondary"
                        compact
                        onPress={() => doAct({ type: 'UNEQUIP', slot: item.slot })}
                        accessibilityLabel={`Remover ${item.name}`}
                      />
                    )
                  ) : isOwned ? (
                    <Button
                      label="Equipar"
                      variant="secondary"
                      compact
                      onPress={() => {
                        doAct({ type: 'EQUIP', itemId: item.id });
                        setPreviewId(null);
                      }}
                      accessibilityLabel={`Equipar ${item.name}`}
                    />
                  ) : (
                    <Button
                      label={affordable ? 'Comprar' : 'Sem moedas'}
                      compact
                      disabled={!affordable}
                      onPress={() => setBuying(item)}
                      accessibilityLabel={
                        affordable
                          ? `Comprar ${item.name} por ${item.price} moedas`
                          : `${item.name}: moedas insuficientes`
                      }
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <Dialog
        visible={!!buying}
        title={buying ? `Comprar ${buying.name}?` : ''}
        message={
          buying ? `Custa ${buying.price} moedas. Você ficará com ${coins - buying.price}.` : ''
        }
        confirmLabel="Comprar"
        onCancel={() => setBuying(null)}
        onConfirm={() => {
          if (buying) doAct({ type: 'BUY', itemId: buying.id });
          setBuying(null);
          setPreviewId(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', marginVertical: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  balance: { fontFamily: fonts.display, fontSize: 14, color: colors.goldLight },
  group: { marginTop: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  itemSelected: { borderColor: colors.gold },
  itemTop: { alignItems: 'center', gap: 6, minHeight: MIN_TOUCH },
  itemIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontFamily: fonts.bodyBold, fontSize: 13 },
  equippedTag: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha(colors.gold, 0.55),
    alignItems: 'center',
    justifyContent: 'center',
  },
  equippedText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.gold },
});
