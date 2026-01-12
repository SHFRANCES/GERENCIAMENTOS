import { useState, useEffect } from "react";
import api from "../lib/api";
import { formatCurrency } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Package, Edit, Trash2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

const PartForm = ({ part, onSuccess, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: part?.name || "",
    code: part?.code || "",
    supplier: part?.supplier || "",
    cost_price: part?.cost_price || 0,
    sale_price: part?.sale_price || 0,
    quantity: part?.quantity || 0,
    min_quantity: part?.min_quantity || 5,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (part) {
        await api.put(`/parts/${part.id}`, formData);
        toast.success("Peça atualizada!");
      } else {
        await api.post("/parts", formData);
        toast.success("Peça cadastrada!");
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar peça");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          data-testid="part-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            data-testid="part-code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">Fornecedor</Label>
          <Input
            id="supplier"
            data-testid="part-supplier"
            value={formData.supplier}
            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cost_price">Preço de Custo *</Label>
          <Input
            id="cost_price"
            type="number"
            step="0.01"
            data-testid="part-cost"
            value={formData.cost_price}
            onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sale_price">Preço de Venda *</Label>
          <Input
            id="sale_price"
            type="number"
            step="0.01"
            data-testid="part-sale"
            value={formData.sale_price}
            onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantidade</Label>
          <Input
            id="quantity"
            type="number"
            data-testid="part-quantity"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="min_quantity">Quantidade Mínima</Label>
          <Input
            id="min_quantity"
            type="number"
            data-testid="part-min"
            value={formData.min_quantity}
            onChange={(e) => setFormData({ ...formData, min_quantity: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} data-testid="part-submit">
          {loading ? "Salvando..." : part ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

const StockAdjustDialog = ({ part, onSuccess, onClose }) => {
  const [quantity, setQuantity] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleAdjust = async (isAdd) => {
    const adjustQty = isAdd ? Math.abs(quantity) : -Math.abs(quantity);
    if (adjustQty === 0) return;

    setLoading(true);
    try {
      await api.post(`/parts/${part.id}/stock?quantity=${adjustQty}`);
      toast.success("Estoque atualizado!");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error("Erro ao ajustar estoque");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">{part.name}</p>
        <p className="text-sm text-muted-foreground">Estoque atual: {part.quantity}</p>
      </div>
      <div className="space-y-2">
        <Label>Quantidade</Label>
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
          min="1"
          data-testid="adjust-quantity"
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => handleAdjust(true)}
          disabled={loading || quantity <= 0}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          data-testid="add-stock"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Entrada
        </Button>
        <Button
          onClick={() => handleAdjust(false)}
          disabled={loading || quantity <= 0}
          variant="destructive"
          className="flex-1"
          data-testid="remove-stock"
        >
          <TrendingDown className="mr-2 h-4 w-4" />
          Saída
        </Button>
      </div>
    </div>
  );
};

const Stock = () => {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);

  const fetchParts = async () => {
    try {
      const params = [];
      if (search) params.push(`search=${search}`);
      if (showLowStock) params.push("low_stock=true");
      const url = `/parts${params.length > 0 ? `?${params.join("&")}` : ""}`;
      const response = await api.get(url);
      setParts(response.data);
    } catch (error) {
      toast.error("Erro ao carregar peças");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, [search, showLowStock]);

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir esta peça?")) return;

    try {
      await api.delete(`/parts/${id}`);
      toast.success("Peça removida!");
      fetchParts();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao remover peça");
    }
  };

  const lowStockCount = parts.filter((p) => p.quantity <= p.min_quantity).length;

  return (
    <div className="space-y-6" data-testid="stock-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <p className="text-muted-foreground">Controle de peças e componentes</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedPart(null)} data-testid="new-part-btn">
              <Plus className="mr-2 h-4 w-4" />
              Nova Peça
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedPart ? "Editar Peça" : "Nova Peça"}</DialogTitle>
            </DialogHeader>
            <PartForm
              part={selectedPart}
              onSuccess={fetchParts}
              onClose={() => {
                setSelectedPart(null);
                setDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">{lowStockCount} peça(s) com estoque baixo</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLowStock(!showLowStock)}
            className="ml-auto"
          >
            {showLowStock ? "Ver todas" : "Ver baixo estoque"}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="part-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : parts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Nenhuma peça encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peça</TableHead>
                    <TableHead className="hidden md:table-cell">Código</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead className="hidden lg:table-cell">Custo</TableHead>
                    <TableHead>Venda</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parts.map((part) => (
                    <TableRow key={part.id} data-testid={`part-row-${part.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{part.name}</p>
                          {part.supplier && (
                            <p className="text-xs text-muted-foreground">{part.supplier}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-sm">
                        {part.code || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={part.quantity <= part.min_quantity ? "destructive" : "secondary"}
                        >
                          {part.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatCurrency(part.cost_price)}
                      </TableCell>
                      <TableCell>{formatCurrency(part.sale_price)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Dialog
                            open={adjustDialogOpen && selectedPart?.id === part.id}
                            onOpenChange={(open) => {
                              setAdjustDialogOpen(open);
                              if (!open) setSelectedPart(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedPart(part)}
                                data-testid={`adjust-stock-${part.id}`}
                              >
                                <Package className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Ajustar Estoque</DialogTitle>
                              </DialogHeader>
                              {selectedPart && (
                                <StockAdjustDialog
                                  part={selectedPart}
                                  onSuccess={fetchParts}
                                  onClose={() => {
                                    setAdjustDialogOpen(false);
                                    setSelectedPart(null);
                                  }}
                                />
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedPart(part);
                              setDialogOpen(true);
                            }}
                            data-testid={`edit-part-${part.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(part.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`delete-part-${part.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Stock;
