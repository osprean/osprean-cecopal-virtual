import { useMemo, useState } from "react";
import { Flex, HStack, IconButton, Text } from "@chakra-ui/react";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";

interface PaginationBarProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export const PaginationBar = ({ page, pageCount, pageSize, total, onChange }: PaginationBarProps) => {
  if (pageCount <= 1) return null;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <Flex
      justify="space-between"
      align="center"
      px={2}
      py={1.5}
      mt={1}
      bg="bg.panelSubtle"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="md"
    >
      <Text fontSize="10px" fontFamily="mono" color="text.muted" letterSpacing="wider">
        {from}-{to} / {total}
      </Text>
      <HStack spacing={1}>
        <IconButton
          aria-label="Anterior"
          size="xs"
          variant="ghost"
          icon={<MdChevronLeft />}
          isDisabled={page === 0}
          onClick={() => onChange(page - 1)}
        />
        <Text fontSize="10px" fontFamily="mono" color="text.secondary" fontWeight={800} minW="38px" textAlign="center">
          {page + 1} / {pageCount}
        </Text>
        <IconButton
          aria-label="Siguiente"
          size="xs"
          variant="ghost"
          icon={<MdChevronRight />}
          isDisabled={page >= pageCount - 1}
          onClick={() => onChange(page + 1)}
        />
      </HStack>
    </Flex>
  );
};

export const usePagination = <T,>(items: T[], pageSize: number) => {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );
  return {
    page: safePage,
    pageCount,
    pageSize,
    total: items.length,
    pageItems,
    setPage,
  };
};
