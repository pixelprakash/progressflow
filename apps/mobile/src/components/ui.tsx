import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({
  name,
  size = 22,
  color = theme.color.text,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color} />;
}

type BtnKind = 'primary' | 'outline' | 'ghost' | 'danger';

export function Btn({
  label,
  icon,
  onPress,
  kind = 'primary',
  disabled,
  flex,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  flex?: boolean;
}) {
  const fg = kind === 'primary' || kind === 'danger' ? '#fff' : theme.color.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        kind === 'primary' && { backgroundColor: theme.color.primary },
        kind === 'danger' && { backgroundColor: theme.color.danger },
        kind === 'outline' && { borderWidth: 2, borderColor: theme.color.primary },
        flex && { flex: 1 },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {icon ? <Icon name={icon} color={fg} size={22} /> : null}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconBtn({
  icon,
  label,
  onPress,
  active,
  disabled,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconBtn,
        active && s.iconBtnActive,
        disabled && { opacity: 0.35 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon
        name={icon}
        color={color ?? (active ? theme.color.primary : theme.color.text)}
        size={24}
      />
      <Text style={[s.iconBtnLabel, active && { color: theme.color.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
  color,
}: {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const c = color ?? theme.color.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        s.chip,
        selected ? { backgroundColor: c, borderColor: c } : { borderColor: theme.color.border },
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={selected ? '#fff' : c} /> : null}
      <Text style={[s.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + theme.space.md }]}>
        <View style={s.sheetHead}>
          <Text style={s.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Icon name="close" size={26} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: theme.space.md, paddingBottom: theme.space.md }}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + theme.space.sm }]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back" style={s.back}>
          <Icon name="arrow-left" size={26} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    minHeight: theme.tapTarget,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
  },
  btnText: { fontSize: theme.font.body, fontWeight: '700' },
  iconBtn: {
    minWidth: 64,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
  },
  iconBtnActive: { backgroundColor: theme.color.primarySoft },
  iconBtnLabel: { fontSize: 12, color: theme.color.textMuted, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: theme.color.text },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#fff',
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.space.md,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space.sm,
  },
  sheetTitle: { fontSize: theme.font.title, fontWeight: '700', color: theme.color.text },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.sm,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.color.text },
  headerSub: { fontSize: 13, color: theme.color.textMuted },
});
