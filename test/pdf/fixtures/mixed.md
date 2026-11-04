## Özdeğerler

Bir **A** matrisi için sıfırdan farklı bir $v$ vektörü $Av = \lambda v$ eşitliğini sağlıyorsa $\lambda$ bir özdeğerdir.

$$
\det(A - \lambda I) = 0
$$

> [!tip|💡] İpucu
>
> Karakteristik polinomun kökleri özdeğerlerdir.

![örnek|400](<attachments/örnek görsel ş.png>)
*Şekil 1: örnek görsel*

### Kod örneği

```python
import numpy as np

A = np.array([[2, 0], [0, 3]])
vals, vecs = np.linalg.eig(A)
print(vals)
```

<details>
<summary>Çözüm (toggle)</summary>

Toggle içeriği PDF'te açık basılır.

</details>

| Gezegen | Yarıçap (km) | Uydu sayısı |
| :-- | :-: | --: |
| Mars | 3 390 | 2 |
| Jüpiter | 69 911 | 95 |

- [x] Tanımı öğren
- [ ] Örnek çöz

<mark data-color="yellow">Sınavda çıkar</mark> ve [bağlantı](https://example.com).
